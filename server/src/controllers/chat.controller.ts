import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { Server } from 'socket.io';
import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { sendPushNotification } from '../services/push.service.js';
import { redisClient } from '../services/redis.service.js';


export async function getChats(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      })
      .sort({ updatedAt: -1 });

    const uniqueParticipantIds = Array.from(
      new Set(
        chats.flatMap((chat) => chat.participants.map((p) => (p as any)._id.toString()))
      )
    );

    const presenceMap = new Map<string, boolean>();

    if (redisClient && uniqueParticipantIds.length > 0) {
      try {
        const keys = uniqueParticipantIds.map((id) => `user:presence:${id}`);
        const results = await redisClient.mget(...keys);
        uniqueParticipantIds.forEach((id, idx) => {
          presenceMap.set(id, results[idx] === 'online');
        });
      } catch (err) {
        console.error('Error fetching presence from Redis MGET:', err);
      }
    }

    const chatsWithPresence = chats.map((chat) => {
      const chatObj = chat.toObject();
      chatObj.participants = chatObj.participants.map((p: any) => ({
        ...p,
        isOnline: presenceMap.get(p._id.toString()) || false,
      }));
      return chatObj;
    });

    return res.status(200).json({ chats: chatsWithPresence });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error retrieving chats', error: error.message });
  }
}

export async function createChat(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { participantId, searchContact } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    let targetUserId = participantId;

    // Search target user if connectId or email is provided
    if (searchContact) {
      const queryStr = searchContact.toLowerCase().trim();
      const targetUser = await User.findOne({
        $or: [
          { connectId: queryStr },
          { email: queryStr }
        ]
      });

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found with this ID or Email.' });
      }

      if (targetUser._id.toString() === userId) {
        return res.status(400).json({ message: 'You cannot add yourself as a contact.' });
      }

      targetUserId = targetUser._id;
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'Participant identifier required' });
    }

    // Check if 1:1 chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] },
    });

    const enrichPresenceSingle = async (chatDoc: any) => {
      const populated = await chatDoc.populate('participants', 'displayName email avatarUrl status connectId age lastSeen');
      const chatObj = populated.toObject();
      const presenceKeys = chatObj.participants.map((p: any) => `user:presence:${p._id.toString()}`);
      if (redisClient && presenceKeys.length > 0) {
        try {
          const results = await redisClient.mget(...presenceKeys);
          chatObj.participants = chatObj.participants.map((p: any, idx: number) => ({
            ...p,
            isOnline: results[idx] === 'online',
          }));
        } catch (err) {
          console.error('Error fetching presence for single chat:', err);
        }
      } else {
        chatObj.participants = chatObj.participants.map((p: any) => ({
          ...p,
          isOnline: false,
        }));
      }
      return chatObj;
    };

    if (chat) {
      const chatWithPresence = await enrichPresenceSingle(chat);
      return res.status(200).json({ chat: chatWithPresence, isNew: false });
    }

    // Create new chat
    chat = new Chat({
      participants: [userId, targetUserId],
      unreadCounts: new Map([[userId, 0], [targetUserId, 0]]),
    });

    await chat.save();
    const chatWithPresence = await enrichPresenceSingle(chat);

    // Programmatically join socket rooms for both participants on backend if they are connected
    const io = req.app.get('io') as Server;
    if (io) {
      io.in(`user:${userId}`).socketsJoin(`chat:${chat._id}`);
      io.in(`user:${targetUserId}`).socketsJoin(`chat:${chat._id}`);
      // Notify the other user that a chat has been created
      io.to(`user:${targetUserId}`).emit('chat_created', chatWithPresence);
    }

    return res.status(201).json({ chat: chatWithPresence, isNew: true });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error creating chat', error: error.message });
  }
}

export async function getMessages(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { before, limit = 20 } = req.query;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    // Verify membership
    const chat = await Chat.findOne({ _id: chatId, participants: userId } as any);
    if (!chat) return res.status(403).json({ message: 'Forbidden' });

    const query: any = { chat: chatId, deletedForUsers: { $ne: userId } };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'displayName avatarUrl status')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'displayName' }
      });

    return res.status(200).json({ messages });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error retrieving messages', error: error.message });
  }
}

export async function sendMessageHttp(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { 
    text, tempId, replyTo,
    mediaUrl, mediaType, mediaDuration, mediaSize, mediaWidth, mediaHeight
  } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!text && !mediaUrl) {
    return res.status(400).json({ message: 'Message text or media is required' });
  }

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId } as any);
    if (!chat) return res.status(403).json({ message: 'Forbidden' });

    const message = new Message({
      chat: chatId,
      sender: userId,
      text: text || '',
      status: 'sent',
      tempId,
      replyTo: replyTo || null,
      mediaUrl,
      mediaType,
      mediaDuration,
      mediaSize,
      mediaWidth,
      mediaHeight,
    });
    await message.save();

    const populatedMessage = await message.populate([
      { path: 'sender', select: 'displayName avatarUrl status' },
      { path: 'replyTo', populate: { path: 'sender', select: 'displayName' } }
    ]);

    // Update last message & unread counters
    chat.lastMessage = message._id as any;
    chat.participants.forEach((pId) => {
      if (pId.toString() !== userId) {
        const count = chat.unreadCounts.get(pId.toString()) || 0;
        chat.unreadCounts.set(pId.toString(), count + 1);
      }
    });
    await chat.save();

    // Broadcast to other sockets
    const io = req.app.get('io') as Server;
    if (io) {
      io.to(`chat:${chatId}`).emit('new_message', populatedMessage);

      // Send push notifications to other participants who are not actively in this chat room
      try {
        const chatRoom = `chat:${chatId}`;
        const socketsInChat = await io.in(chatRoom).fetchSockets();
        const activeUserIds = new Set(socketsInChat.map((s: any) => s.user?.userId));

        const senderName = (populatedMessage.sender as any).displayName || 'Someone';

        let bodyText = text || '';
        if (!bodyText && mediaType) {
          const typeIcons: Record<string, string> = { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Voice note' };
          bodyText = typeIcons[mediaType] || 'Sent a file';
        }

        chat.participants.forEach((pId) => {
          const recipientId = pId.toString();
          if (recipientId !== userId && !activeUserIds.has(recipientId)) {
            sendPushNotification(recipientId, {
              title: senderName,
              body: bodyText,
              data: { chatId, messageId: message._id.toString() },
            });
          }
        });
      } catch (e) {
        console.error('Failed to dispatch HTTP push notifications:', e);
      }
    }

    return res.status(201).json({ message: populatedMessage });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
}

export async function forwardMessages(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { messageIds, chatIds, searchContacts } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ message: 'messageIds array is required' });
  }

  try {
    // 1. Fetch the source messages to forward
    const sourceMessages = await Message.find({ _id: { $in: messageIds } }).sort({ createdAt: 1 });
    if (sourceMessages.length === 0) {
      return res.status(404).json({ message: 'No messages found to forward' });
    }

    // 2. Resolve all target chat IDs (including creating chats for searchContacts)
    const resolvedChatIds: string[] = [];
    if (chatIds && Array.isArray(chatIds)) {
      resolvedChatIds.push(...chatIds);
    }

    if (searchContacts && Array.isArray(searchContacts)) {
      for (const contact of searchContacts) {
        const queryStr = contact.toLowerCase().trim();
        if (!queryStr) continue;

        const targetUser = await User.findOne({
          $or: [
            { connectId: queryStr },
            { email: queryStr }
          ]
        });

        if (targetUser && targetUser._id.toString() !== userId) {
          // Check if chat already exists
          let chat = await Chat.findOne({
            participants: { $all: [userId, targetUser._id] },
          });

          if (!chat) {
            chat = new Chat({
              participants: [userId, targetUser._id],
              unreadCounts: new Map([[userId, 0], [targetUser._id.toString(), 0]]),
            });
            await chat.save();

            const populatedChat = await chat.populate('participants', 'displayName email avatarUrl status connectId age');
            const io = req.app.get('io') as Server;
            if (io) {
              io.in(`user:${userId}`).socketsJoin(`chat:${chat._id}`);
              io.in(`user:${targetUser._id}`).socketsJoin(`chat:${chat._id}`);
              io.to(`user:${targetUser._id}`).emit('chat_created', populatedChat);
            }
          }
          resolvedChatIds.push(chat._id.toString());
        }
      }
    }

    // Ensure we have unique chat IDs
    const uniqueChatIds = Array.from(new Set(resolvedChatIds));
    if (uniqueChatIds.length === 0) {
      return res.status(400).json({ message: 'No valid recipient chats resolved' });
    }

    const io = req.app.get('io') as Server;
    const sentMessagesByChat: Record<string, any[]> = {};

    // 3. For each unique chat, create and send the messages
    for (const chatId of uniqueChatIds) {
      const chat = await Chat.findOne({ _id: chatId, participants: userId });
      if (!chat) continue;

      sentMessagesByChat[chatId] = [];

      for (const srcMsg of sourceMessages) {
        const message = new Message({
          chat: chatId,
          sender: userId,
          text: srcMsg.text,
          status: 'sent',
          isForwarded: true,
          mediaUrl: srcMsg.mediaUrl,
          mediaType: srcMsg.mediaType,
          mediaDuration: srcMsg.mediaDuration,
          mediaSize: srcMsg.mediaSize,
          mediaWidth: srcMsg.mediaWidth,
          mediaHeight: srcMsg.mediaHeight,
        });
        await message.save();

        const populated = await message.populate('sender', 'displayName avatarUrl status');

        chat.lastMessage = message._id as any;
        chat.participants.forEach((pId) => {
          if (pId.toString() !== userId) {
            const count = chat.unreadCounts.get(pId.toString()) || 0;
            chat.unreadCounts.set(pId.toString(), count + 1);
          }
        });

        sentMessagesByChat[chatId].push(populated);

        if (io) {
          io.to(`chat:${chatId}`).emit('new_message', populated);

          // Send push notifications to other participants who are not actively in this chat room
          try {
            const chatRoom = `chat:${chatId}`;
            const socketsInChat = await io.in(chatRoom).fetchSockets();
            const activeUserIds = new Set(socketsInChat.map((s: any) => s.user?.userId));

            const senderName = (populated.sender as any).displayName || 'Someone';

            let bodyText = srcMsg.text || '';
            if (!bodyText && srcMsg.mediaType) {
              const typeIcons: Record<string, string> = { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Voice note' };
              bodyText = typeIcons[srcMsg.mediaType] || 'Sent a file';
            }

            chat.participants.forEach((pId) => {
              const recipientId = pId.toString();
              if (recipientId !== userId && !activeUserIds.has(recipientId)) {
                sendPushNotification(recipientId, {
                  title: senderName,
                  body: bodyText,
                  data: { chatId, messageId: message._id.toString() },
                });
              }
            });
          } catch (e) {
            console.error('Failed to dispatch forward push notification:', e);
          }
        }
      }
      await chat.save();
    }

    return res.status(200).json({ success: true, forwarded: sentMessagesByChat });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error forwarding messages', error: error.message });
  }
}

export async function createGroup(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { name, participants, avatarUrl, avatarPublicId } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  // Ensure participants list is an array and does not exceed the limit (150)
  if (!Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ message: 'At least one participant is required' });
  }

  const uniqueParticipants = Array.from(new Set([...participants, userId]));

  if (uniqueParticipants.length > 150) {
    return res.status(400).json({ message: 'Group size cannot exceed 150 participants.' });
  }

  try {
    const chat = new Chat({
      isGroup: true,
      name: name.trim(),
      avatarUrl: avatarUrl || '',
      avatarPublicId: avatarPublicId || '',
      creator: userId,
      admins: [userId],
      participants: uniqueParticipants,
      unreadCounts: new Map(uniqueParticipants.map(id => [id, 0])),
    });

    await chat.save();
    
    // Enrich with presence and participant details
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      });

    const chatObj = populatedChat!.toObject();
    const presenceKeys = chatObj.participants.map((p: any) => `user:presence:${p._id.toString()}`);
    if (redisClient && presenceKeys.length > 0) {
      try {
        const results = await redisClient.mget(...presenceKeys);
        chatObj.participants = chatObj.participants.map((p: any, idx: number) => ({
          ...p,
          isOnline: results[idx] === 'online',
        }));
      } catch (err) {
        console.error('Error fetching presence for new group:', err);
      }
    } else {
      chatObj.participants = chatObj.participants.map((p: any) => ({
        ...p,
        isOnline: false,
      }));
    }

    // Programmatically join socket rooms on backend
    const io = req.app.get('io') as Server;
    if (io) {
      uniqueParticipants.forEach((pId) => {
        io.in(`user:${pId}`).socketsJoin(`chat:${chat._id}`);
        // Notify other online users
        if (pId !== userId) {
          io.to(`user:${pId}`).emit('chat_created', chatObj);
        }
      });
      // Broadcast group_created inside the group
      io.to(`chat:${chat._id}`).emit('group_created', chatObj);
    }

    return res.status(201).json({ chat: chatObj });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error creating group chat', error: error.message });
  }
}

export async function updateGroupSettings(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { name, avatarUrl, avatarPublicId } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId, isGroup: true } as any);
    if (!chat) return res.status(404).json({ message: 'Group chat not found or unauthorized' });

    // Validate request user is admin
    const isAdmin = chat.admins.some((adminId) => adminId.toString() === userId);
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Only group admins can update settings' });
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: 'Group name cannot be empty' });
      chat.name = name.trim();
    }
    if (avatarUrl !== undefined) chat.avatarUrl = avatarUrl;
    if (avatarPublicId !== undefined) chat.avatarPublicId = avatarPublicId;

    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      });

    const chatObj = populatedChat!.toObject();
    
    // Broadcast changes
    const io = req.app.get('io') as Server;
    if (io) {
      io.to(`chat:${chatId}`).emit('group_updated', chatObj);
    }

    return res.status(200).json({ chat: chatObj });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error updating group settings', error: error.message });
  }
}

export async function addGroupMembers(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { userIds } = req.body; // array of strings

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'Participant IDs are required' });
  }

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId, isGroup: true } as any);
    if (!chat) return res.status(404).json({ message: 'Group chat not found or unauthorized' });

    const isAdmin = chat.admins.some((adminId) => adminId.toString() === userId);
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Only group admins can add members' });
    }

    const currentParticipants = chat.participants.map(p => p.toString());
    const validNewUserIds = userIds.filter(id => !currentParticipants.includes(id));

    if (chat.participants.length + validNewUserIds.length > 150) {
      return res.status(400).json({ message: 'Group size cannot exceed 150 participants.' });
    }

    validNewUserIds.forEach((id) => {
      chat.participants.push(new mongoose.Types.ObjectId(id) as any);
      chat.unreadCounts.set(id, 0);
    });

    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      });

    const chatObj = populatedChat!.toObject();

    // Join new participants' sockets and notify
    const io = req.app.get('io') as Server;
    if (io) {
      validNewUserIds.forEach((newId) => {
        io.in(`user:${newId}`).socketsJoin(`chat:${chat._id}`);
        io.to(`user:${newId}`).emit('chat_created', chatObj);
      });
      // Broadcast to room
      io.to(`chat:${chatId}`).emit('group_updated', chatObj);
      io.to(`chat:${chatId}`).emit('member_joined', { chatId, userIds: validNewUserIds });
    }

    return res.status(200).json({ chat: chatObj });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error adding group members', error: error.message });
  }
}

export async function removeGroupMember(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const memberId = req.params.memberId as string;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId, isGroup: true } as any);
    if (!chat) return res.status(404).json({ message: 'Group chat not found or unauthorized' });

    const isAdmin = chat.admins.some((adminId) => adminId.toString() === userId);
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Only group admins can remove members' });
    }

    if (chat.creator && chat.creator.toString() === memberId) {
      return res.status(400).json({ message: 'Cannot remove the group creator' });
    }

    chat.participants = chat.participants.filter(p => p.toString() !== memberId);
    chat.admins = chat.admins.filter(a => a.toString() !== memberId);
    chat.unreadCounts.delete(memberId);

    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      });

    const chatObj = populatedChat!.toObject();

    const io = req.app.get('io') as Server;
    if (io) {
      // Broadcast to room before kicking their socket out
      io.to(`chat:${chatId}`).emit('group_updated', chatObj);
      io.to(`chat:${chatId}`).emit('member_removed', { chatId, userId: memberId });
      io.to(`user:${memberId}`).emit('chat_deleted', { chatId });
      io.in(`user:${memberId}`).socketsLeave(`chat:${chat._id}`);
    }

    return res.status(200).json({ chat: chatObj });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error removing group member', error: error.message });
  }
}

export async function leaveGroup(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId, isGroup: true } as any);
    if (!chat) return res.status(404).json({ message: 'Group chat not found or unauthorized' });

    // Filter out the leaving user
    const remainingParticipants = chat.participants.filter(p => p.toString() !== userId);

    if (remainingParticipants.length === 0) {
      // Last participant leaves, delete chat and its messages
      await Chat.findByIdAndDelete(chatId);
      await Message.deleteMany({ chat: chatId } as any);
      
      const io = req.app.get('io') as Server;
      if (io) {
        io.in(`user:${userId}`).socketsLeave(`chat:${chat._id}`);
      }
      return res.status(200).json({ success: true, message: 'Group deleted since no members remain' });
    }

    chat.participants = remainingParticipants;
    chat.unreadCounts.delete(userId as string);

    const isUserAdmin = chat.admins.some((adminId) => adminId.toString() === userId);
    chat.admins = chat.admins.filter(a => a.toString() !== userId);

    // If leaving user was the sole admin (or creator), promote the oldest remaining participant
    if (isUserAdmin && chat.admins.length === 0 && remainingParticipants.length > 0) {
      const nextAdminId = remainingParticipants[0];
      if (nextAdminId) {
        chat.admins.push(nextAdminId);
        if (chat.creator && chat.creator.toString() === userId) {
          chat.creator = nextAdminId; // delegate ownership
        }
      }
    }

    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      });

    const chatObj = populatedChat!.toObject();

    const io = req.app.get('io') as Server;
    if (io) {
      io.to(`chat:${chatId}`).emit('group_updated', chatObj);
      io.to(`chat:${chatId}`).emit('member_left', { chatId, userId });
      io.in(`user:${userId}`).socketsLeave(`chat:${chat._id}`);
    }

    return res.status(200).json({ success: true, chat: chatObj });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error leaving group chat', error: error.message });
  }
}

export async function promoteGroupAdmin(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { userId: targetUserId, action } = req.body; // action: 'promote' | 'demote'

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!targetUserId || !action) {
    return res.status(400).json({ message: 'Target userId and action are required' });
  }

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId, isGroup: true } as any);
    if (!chat) return res.status(404).json({ message: 'Group chat not found or unauthorized' });

    // Validate current user is admin
    const isAdmin = chat.admins.some((adminId) => adminId.toString() === userId);
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Only group admins can manage admin roles' });
    }

    // Creator checks: Creator cannot be demoted
    if (action === 'demote' && chat.creator && chat.creator.toString() === targetUserId) {
      return res.status(400).json({ message: 'Cannot demote the group creator' });
    }

    const currentAdmins = chat.admins.map(a => a.toString());

    if (action === 'promote') {
      if (!currentAdmins.includes(targetUserId)) {
        chat.admins.push(new mongoose.Types.ObjectId(targetUserId) as any);
      }
    } else if (action === 'demote') {
      chat.admins = chat.admins.filter(a => a.toString() !== targetUserId);
    } else {
      return res.status(400).json({ message: 'Invalid action. Must be promote or demote' });
    }

    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'displayName email avatarUrl status connectId age lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      });

    const chatObj = populatedChat!.toObject();

    const io = req.app.get('io') as Server;
    if (io) {
      io.to(`chat:${chatId}`).emit('group_updated', chatObj);
    }

    return res.status(200).json({ chat: chatObj });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error managing admin roles', error: error.message });
  }
}

export async function searchMessages(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params; // Optional: if provided, searches in this chat. If not, searches all user chats.
  const { q } = req.query;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!q || !q.toString().trim()) {
    return res.status(400).json({ message: 'Search query required' });
  }

  const queryStr = q.toString().trim();

  try {
    let chatIds: any[] = [];

    if (chatId) {
      // Search in specific chat
      const chat = await Chat.findOne({ _id: chatId, participants: userId });
      if (!chat) return res.status(404).json({ message: 'Chat not found or unauthorized' });
      chatIds = [chat._id];
    } else {
      // Search in all chats of user
      const chats = await Chat.find({ participants: userId });
      chatIds = chats.map((c) => c._id);
    }

    if (chatIds.length === 0) {
      return res.status(200).json({ messages: [] });
    }

    const query = {
      chat: { $in: chatIds },
      text: { $regex: queryStr, $options: 'i' },
      isDeleted: false,
      deletedForUsers: { $ne: userId },
    };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'displayName avatarUrl status')
      .populate({
        path: 'chat',
        select: 'name isGroup participants',
        populate: { path: 'participants', select: 'displayName' }
      });

    return res.status(200).json({ messages });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error searching messages', error: error.message });
  }
}

