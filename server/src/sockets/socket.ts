import { Server, Socket } from 'socket.io';
import { verifyAccessToken, type TokenPayload } from '../services/jwt.service.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { redisClient } from '../services/redis.service.js';
import { sendPushNotification } from '../services/push.service.js';

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

    let userChats: any[] = [];
    try {
      userChats = await Chat.find({ participants: userId });
    } catch (e) {
      console.error('Error finding user chats for connecting socket:', e);
    }

    // Presence: Track Redis connections
    if (redisClient) {
      try {
        const connKey = `user:connections:${userId}`;
        const presenceKey = `user:presence:${userId}`;
        const currentConnections = await redisClient.incr(connKey);
        
        if (currentConnections === 1) {
          await redisClient.set(presenceKey, 'online');
          // Broadcast to all of the user's chats
          for (const chat of userChats) {
            if (chat.isGroup) {
              socket.to(`chat:${chat._id}`).emit('presence_change', {
                userId,
                isOnline: true,
              });
            } else {
              const recipientId = chat.participants.find((pId: any) => pId.toString() !== userId);
              if (recipientId) {
                const recipientUser = await User.findById(recipientId);
                const senderUser = await User.findById(userId);
                const hasBlock = (recipientUser?.blockedUsers?.includes(userId as any)) || (senderUser?.blockedUsers?.includes(recipientId as any));
                if (!hasBlock) {
                  io.to(`user:${recipientId}`).emit('presence_change', {
                    userId,
                    isOnline: true,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Redis presence connect error:', err);
      }
    }

    // Active chat room tracking
    socket.on('join_chat_room', (data: { chatId: string }) => {
      if (data?.chatId) {
        socket.join(`active_chat:${data.chatId}`);
      }
    });

    socket.on('leave_chat_room', (data: { chatId: string }) => {
      if (data?.chatId) {
        socket.leave(`active_chat:${data.chatId}`);
      }
    });

    // Handle sending a message
    socket.on('send_message', async (data: {
      chatId: string;
      text?: string;
      tempId?: string;
      replyTo?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'audio' | 'document';
      mediaDuration?: number;
      mediaSize?: number;
      mediaWidth?: number;
      mediaHeight?: number;
      linkPreview?: { url: string; title?: string; description?: string; image?: string; domain?: string };
    }, callback) => {
      try {
        const { 
          chatId, text, tempId, replyTo,
          mediaUrl, mediaType, mediaDuration, mediaSize, mediaWidth, mediaHeight, linkPreview
        } = data;
        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) {
          return callback && callback({ success: false, error: 'Unauthorized or chat not found' });
        }

        // Verify block status if 1:1 chat
        if (!chat.isGroup) {
          const recipientId = chat.participants.find((pId) => pId.toString() !== userId);
          if (recipientId) {
            const recipientUser = await User.findById(recipientId);
            if (recipientUser && recipientUser.blockedUsers.includes(userId as any)) {
              return callback && callback({ success: false, error: 'You are blocked by this user.' });
            }
            const senderUser = await User.findById(userId);
            if (senderUser && senderUser.blockedUsers.includes(recipientId as any)) {
              return callback && callback({ success: false, error: 'You have blocked this user. Unblock them to send messages.' });
            }
          }
        } else if (chat.onlyAdminsCanSend) {
          const isAdmin =
            chat.admins.some((adminId) => adminId.toString() === userId) ||
            (chat.creator && chat.creator.toString() === userId);
          if (!isAdmin) {
            return callback && callback({ success: false, error: 'Only admins can send messages in this group' });
          }
        }

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
          linkPreview: linkPreview || null,
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

        // Broadcast message to active chat room & user channels
        io.to(`active_chat:${chatId}`).emit('new_message', populated);
        chat.participants.forEach((pId) => {
          const recipientId = pId.toString();
          if (recipientId !== userId) {
            io.to(`user:${recipientId}`).emit('new_message', populated);
          }
        });

        // Send push notifications to other participants who are not actively in this chat room
        try {
          const activeRoom = `active_chat:${chatId}`;
          const socketsInActiveRoom = await io.in(activeRoom).fetchSockets();
          const activeUserIds = new Set(socketsInActiveRoom.map((s: any) => s.user?.userId));

          const senderName = (populated.sender as any).displayName || 'Someone';

          let bodyText = text || '';
          if (!bodyText && mediaType) {
            const typeIcons: Record<string, string> = { image: '📷 Photo', video: '🎥 Video', audio: '🎵 Voice note', document: '📄 Document' };
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
          console.error('Failed to dispatch socket push notifications:', e);
        }

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
    socket.on('delete_message', async (data: { chatId: string; messageId: string; type?: 'me' | 'everyone' }, callback) => {
      try {
        const { chatId, messageId, type = 'everyone' } = data;

        if (type === 'me') {
          // Verify user is a participant of the chat to delete their view of the message
          const chat = await Chat.findOne({ _id: chatId, participants: userId });
          if (!chat) {
            return callback && callback({ success: false, error: 'Chat not found or unauthorized' });
          }

          const message = await Message.findOne({ _id: messageId, chat: chatId });
          if (!message) {
            return callback && callback({ success: false, error: 'Message not found' });
          }

          // Add user to deletedForUsers array if not already present
          if (message.deletedForUsers && !message.deletedForUsers.includes(userId as any)) {
            message.deletedForUsers.push(userId as any);
            await message.save();
          }

          if (callback) callback({ success: true, messageId, type: 'me' });
        } else {
          // Delete for everyone (only message sender is authorized)
          const message = await Message.findOne({ _id: messageId, chat: chatId, sender: userId });
          if (!message) {
            return callback && callback({ success: false, error: 'Message not found or unauthorized' });
          }

          message.text = 'This message was deleted';
          message.isDeleted = true;
          await message.save();

          io.to(`chat:${chatId}`).emit('message_deleted', { chatId, messageId, text: message.text, isDeleted: true });
          if (callback) callback({ success: true, messageId, type: 'everyone' });
        }
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

    // Mark message as delivered when received by recipient client
    socket.on('mark_delivered', async (data: { chatId: string; messageId: string }) => {
      try {
        const { chatId, messageId } = data;
        const message = await Message.findOne({ _id: messageId, chat: chatId });
        if (message && message.status === 'sent' && message.sender.toString() !== userId) {
          message.status = 'delivered';
          await message.save();
          io.to(`chat:${chatId}`).emit('message_delivered', { chatId, messageId, status: 'delivered' });
        }
      } catch (e) {
        console.error('Socket mark_delivered error:', e);
      }
    });

    // Handle emoji reactions on messages
    socket.on('send_reaction', async (data: { chatId: string; messageId: string; emoji: string }, callback) => {
      try {
        const { chatId, messageId, emoji } = data;
        const message = await Message.findOne({ _id: messageId, chat: chatId });
        if (!message) {
          return callback && callback({ success: false, error: 'Message not found' });
        }

        if (!message.reactions) message.reactions = [];

        const existingIdx = message.reactions.findIndex((r: any) => r.user?.toString() === userId);
        if (existingIdx > -1) {
          if (message.reactions[existingIdx]?.emoji === emoji) {
            message.reactions.splice(existingIdx, 1); // Toggle off if same emoji tapped
          } else {
            message.reactions[existingIdx]!.emoji = emoji; // Change emoji
          }
        } else {
          message.reactions.push({ user: userId as any, emoji });
        }

        await message.save();

        io.to(`chat:${chatId}`).emit('message_reaction_updated', {
          chatId,
          messageId,
          reactions: message.reactions,
        });

        if (callback) callback({ success: true, reactions: message.reactions });
      } catch (err: any) {
        console.error('Socket send_reaction error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Typing indicators
    socket.on('typing_start', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('typing_start', {
        chatId: data.chatId,
        userId,
      });
    });

    socket.on('typing_stop', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('typing_stop', {
        chatId: data.chatId,
        userId,
      });
    });

    socket.on('disconnect', async () => {
      console.log(`Socket client disconnected: ${userId}`);
      if (redisClient) {
        try {
          const connKey = `user:connections:${userId}`;
          const presenceKey = `user:presence:${userId}`;
          const remainingConnections = await redisClient.decr(connKey);
          
          if (remainingConnections <= 0) {
            await redisClient.del(connKey);
            await redisClient.del(presenceKey);
            
            const lastSeenDate = new Date();
            await User.findByIdAndUpdate(userId, { lastSeen: lastSeenDate });

            // Broadcast offline state to all active chats of the user
            for (const chat of userChats) {
              if (chat.isGroup) {
                io.to(`chat:${chat._id}`).emit('presence_change', {
                  userId,
                  isOnline: false,
                  lastSeen: lastSeenDate.toISOString(),
                });
              } else {
                const recipientId = chat.participants.find((p: any) => p.toString() !== userId);
                if (recipientId) {
                  const recipientUser = await User.findById(recipientId);
                  const senderUser = await User.findById(userId);
                  const hasBlock = (recipientUser?.blockedUsers?.includes(userId as any)) || (senderUser?.blockedUsers?.includes(recipientId as any));
                  if (!hasBlock) {
                    io.to(`user:${recipientId}`).emit('presence_change', {
                      userId,
                      isOnline: false,
                      lastSeen: lastSeenDate.toISOString(),
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('Redis presence disconnect error:', err);
        }
      }
    });
  });
}
