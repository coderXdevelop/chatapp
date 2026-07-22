import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { Server } from 'socket.io';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

export async function getChats(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const chats = await Chat.find({ participants: userId })
      .populate('participants', 'displayName email avatarUrl status')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'displayName' },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({ chats });
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

    if (chat) {
      const populatedChat = await chat.populate('participants', 'displayName email avatarUrl status connectId');
      return res.status(200).json({ chat: populatedChat, isNew: false });
    }

    // Create new chat
    chat = new Chat({
      participants: [userId, targetUserId],
      unreadCounts: new Map([[userId, 0], [targetUserId, 0]]),
    });

    await chat.save();
    const populatedChat = await chat.populate('participants', 'displayName email avatarUrl status connectId');

    // Programmatically join socket rooms for both participants on backend if they are connected
    const io = req.app.get('io') as Server;
    if (io) {
      io.in(`user:${userId}`).socketsJoin(`chat:${chat._id}`);
      io.in(`user:${targetUserId}`).socketsJoin(`chat:${chat._id}`);
      // Notify the other user that a chat has been created
      io.to(`user:${targetUserId}`).emit('chat_created', populatedChat);
    }

    return res.status(201).json({ chat: populatedChat, isNew: true });
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

    const query: any = { chat: chatId };
    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'displayName avatarUrl status');

    return res.status(200).json({ messages });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error retrieving messages', error: error.message });
  }
}

export async function sendMessageHttp(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { text, tempId } = req.body;

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
    });
    await message.save();

    const populatedMessage = await message.populate('sender', 'displayName avatarUrl status');

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
    }

    return res.status(201).json({ message: populatedMessage });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
}
