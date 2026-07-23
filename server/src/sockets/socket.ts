import { Server, Socket } from 'socket.io';
import { verifyAccessToken, type TokenPayload } from '../services/jwt.service.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

export interface AuthenticatedSocket extends Socket {
  user?: TokenPayload;
}

export function setupSockets(io: Server) {
  // Authentication middleware for socket connections
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Auth failed: Token missing'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.user = payload;
      next();
    } catch (err) {
      return next(new Error('Auth failed: Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.user?.userId;
    if (!userId) return;

    console.log(`Socket client connected: ${userId}`);
    await socket.join(`user:${userId}`);

    // Programmatically join socket to room for each of its active chats
    try {
      const userChats = await Chat.find({ participants: userId });
      userChats.forEach((chat) => {
        socket.join(`chat:${chat._id}`);
      });
    } catch (e) {
      console.error('Error joining chat rooms for connecting socket:', e);
    }

    // Handle sending a message
    socket.on('send_message', async (data: { chatId: string; text: string; tempId?: string; replyTo?: string }, callback) => {
      try {
        const { chatId, text, tempId, replyTo } = data;
        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) {
          return callback && callback({ success: false, error: 'Unauthorized or chat not found' });
        }

        const message = new Message({
          chat: chatId,
          sender: userId,
          text,
          status: 'sent',
          tempId,
          replyTo: replyTo || null,
        });
        await message.save();

        const populated = await message.populate([
          { path: 'sender', select: 'displayName avatarUrl status' },
          { path: 'replyTo', populate: { path: 'sender', select: 'displayName' } }
        ]);

        // Update Chat metadata (last message and unread count)
        chat.lastMessage = message._id as any;
        chat.participants.forEach((pId) => {
          if (pId.toString() !== userId) {
            const current = chat.unreadCounts.get(pId.toString()) || 0;
            chat.unreadCounts.set(pId.toString(), current + 1);
          }
        });
        await chat.save();

        // Broadcast message to everyone in the chat room
        io.to(`chat:${chatId}`).emit('new_message', populated);

        if (callback) callback({ success: true, message: populated });
      } catch (err: any) {
        console.error('Socket send_message error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Handle editing a message
    socket.on('edit_message', async (data: { chatId: string; messageId: string; text: string }, callback) => {
      try {
        const { chatId, messageId, text } = data;
        const message = await Message.findOne({ _id: messageId, chat: chatId, sender: userId });
        if (!message) {
          return callback && callback({ success: false, error: 'Message not found or unauthorized' });
        }
        if (message.isDeleted) {
          return callback && callback({ success: false, error: 'Cannot edit a deleted message' });
        }

        message.text = text;
        message.isEdited = true;
        await message.save();

        const populated = await message.populate([
          { path: 'sender', select: 'displayName avatarUrl status' },
          { path: 'replyTo', populate: { path: 'sender', select: 'displayName' } }
        ]);

        io.to(`chat:${chatId}`).emit('message_edited', populated);
        if (callback) callback({ success: true, message: populated });
      } catch (err: any) {
        console.error('Socket edit_message error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Handle deleting a message
    socket.on('delete_message', async (data: { chatId: string; messageId: string }, callback) => {
      try {
        const { chatId, messageId } = data;
        const message = await Message.findOne({ _id: messageId, chat: chatId, sender: userId });
        if (!message) {
          return callback && callback({ success: false, error: 'Message not found or unauthorized' });
        }

        message.text = 'This message was deleted';
        message.isDeleted = true;
        await message.save();

        io.to(`chat:${chatId}`).emit('message_deleted', { chatId, messageId, text: message.text, isDeleted: true });
        if (callback) callback({ success: true, messageId });
      } catch (err: any) {
        console.error('Socket delete_message error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Mark messages as read
    socket.on('read_messages', async (data: { chatId: string }) => {
      try {
        const { chatId } = data;
        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) return;

        chat.unreadCounts.set(userId, 0);
        await chat.save();

        // Update status of all other messages in this chat to 'read'
        await Message.updateMany(
          { chat: chatId, sender: { $ne: userId }, status: { $ne: 'read' } },
          { $set: { status: 'read' } }
        );

        // Notify other user(s) that current user has read the messages
        io.to(`chat:${chatId}`).emit('messages_read', { chatId, userId });
      } catch (e) {
        console.error('Socket read_messages error:', e);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${userId}`);
    });
  });
}
