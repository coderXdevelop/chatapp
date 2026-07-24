import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { Server } from 'socket.io';
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
  const { text, tempId, replyTo } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!text) return res.status(400).json({ message: 'Message text required' });

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId } as any);
    if (!chat) return res.status(403).json({ message: 'Forbidden' });

    const message = new Message({
      chat: chatId,
      sender: userId,
      text,
      status: 'sent',
      tempId,
      replyTo: replyTo || null,
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

        chat.participants.forEach((pId) => {
          const recipientId = pId.toString();
          if (recipientId !== userId && !activeUserIds.has(recipientId)) {
            sendPushNotification(recipientId, {
              title: senderName,
              body: text,
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

            chat.participants.forEach((pId) => {
              const recipientId = pId.toString();
              if (recipientId !== userId && !activeUserIds.has(recipientId)) {
                sendPushNotification(recipientId, {
                  title: senderName,
                  body: srcMsg.text,
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
