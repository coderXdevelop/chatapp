import { Server, Socket } from 'socket.io';
import { verifyAccessToken, type TokenPayload } from '../services/jwt.service.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { redisClient } from '../services/redis.service.js';
import { sendPushNotification, sendCallPushNotification } from '../services/push.service.js';

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
      if (mongoose.connection.readyState === 1) {
        userChats = await Chat.find({ participants: userId, deletedForUsers: { $ne: userId } });
        for (const chat of userChats) {
          await socket.join(`chat:${chat._id}`);
        }
      }
    } catch (e) {
      console.error('Error finding user chats for connecting socket:', e);
    }


    // Explicit client request to rejoin chat rooms upon reconnect
    socket.on('join_chats', async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          const chats = await Chat.find({ participants: userId, deletedForUsers: { $ne: userId } });
          for (const c of chats) {
            await socket.join(`chat:${c._id}`);
          }
        }
      } catch (e) {
        console.error('Error in join_chats listener:', e);
      }
    });


    // Presence: Track user presence in DB & Redis
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
    } catch (err) {
      console.error('Error updating DB online status on connect:', err);
    }

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
    } else {
      // Broadcast online status even if Redis is not configured
      for (const chat of userChats) {
        if (chat.isGroup) {
          socket.to(`chat:${chat._id}`).emit('presence_change', {
            userId,
            isOnline: true,
          });
        } else {
          const recipientId = chat.participants.find((pId: any) => pId.toString() !== userId);
          if (recipientId) {
            io.to(`user:${recipientId}`).emit('presence_change', {
              userId,
              isOnline: true,
            });
          }
        }
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
          io.to(`user:${message.sender.toString()}`).emit('message_delivered', { chatId, messageId, status: 'delivered' });
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

    // ==========================================
    // WebRTC Signaling & Call Events
    // ==========================================

    // Handle call_offer (Caller -> Server -> Recipient)
    socket.on('call_offer', async (data: {
      callId: string;
      recipientId: string;
      isVideo: boolean;
      sdp: any;
      callerInfo: { userId: string; displayName: string; avatarUrl?: string };
      chatId?: string;
    }, callback?: (response: { success: boolean; error?: string }) => void) => {
      try {
        // Feature flag check
        if (process.env.VOICE_VIDEO_CALLS_ENABLED === 'false') {
          if (callback) callback({ success: false, error: 'Voice and video calling is currently disabled.' });
          return;
        }

        const { callId, recipientId, isVideo, sdp, callerInfo, chatId } = data;
        if (!recipientId || !sdp || !callId) {
          if (callback) callback({ success: false, error: 'Invalid offer parameters.' });
          return;
        }

        // Check blocking status with DB connection guard
        let recipientUser: any = null;
        let senderUser: any = null;
        if (mongoose.connection.readyState === 1) {
          try {
            recipientUser = await User.findById(recipientId);
            senderUser = await User.findById(userId);
          } catch (e) {}
        }
        if (!recipientUser) recipientUser = { _id: recipientId, displayName: 'Recipient', blockedUsers: [] };
        if (!senderUser) senderUser = { _id: userId, displayName: callerInfo?.displayName || 'Caller', blockedUsers: [] };



        if (recipientUser.blockedUsers?.some((id: any) => id.toString() === userId)) {
          if (callback) callback({ success: false, error: 'You are blocked by this user.' });
          return;
        }
        if (senderUser.blockedUsers?.some((id: any) => id.toString() === recipientId)) {
          if (callback) callback({ success: false, error: 'You have blocked this user.' });
          return;
        }

        console.log(`[Socket Calling] Forwarding call_offer from ${userId} to user:${recipientId} (callId: ${callId})`);
        // Forward call_offer event to recipient's personal socket room
        io.to(`user:${recipientId}`).emit('call_offer', {
          callId,
          callerId: userId,
          isVideo,
          sdp,
          callerInfo: {
            userId,
            displayName: senderUser.displayName || callerInfo?.displayName || 'User',
            avatarUrl: senderUser.avatarUrl || callerInfo?.avatarUrl,
          },
          chatId,
        });

        // Trigger push notification if recipient is not connected or in background
        const recipientSockets = await io.in(`user:${recipientId}`).fetchSockets();
        if (recipientSockets.length === 0) {
          console.log(`[Socket Calling] Recipient user:${recipientId} offline/background. Triggering push notification.`);
          sendCallPushNotification(recipientId, {
            callerName: senderUser.displayName || 'Someone',
            callId,
            callerId: userId,
            isVideo: !!isVideo,
            ...(chatId ? { chatId } : {}),
          });
        }

        if (callback) callback({ success: true });
      } catch (err: any) {
        console.error('Socket call_offer error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Handle call_answer (Recipient -> Server -> Caller)
    socket.on('call_answer', (data: {
      callId: string;
      callerId: string;
      sdp: any;
    }, callback?: (response: { success: boolean; error?: string }) => void) => {
      try {
        const { callId, callerId, sdp } = data;
        if (!callerId || !sdp || !callId) {
          if (callback) callback({ success: false, error: 'Invalid answer parameters.' });
          return;
        }

        console.log(`[Socket Calling] Forwarding call_answer from ${userId} to user:${callerId} (callId: ${callId})`);
        io.to(`user:${callerId}`).emit('call_answer', {
          callId,
          recipientId: userId,
          sdp,
        });

        if (callback) callback({ success: true });
      } catch (err: any) {
        console.error('Socket call_answer error:', err);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // Handle ice_candidate (Caller/Recipient -> Server -> Peer)
    socket.on('ice_candidate', (data: {
      callId: string;
      targetUserId: string;
      candidate: any;
    }) => {
      try {
        const { callId, targetUserId, candidate } = data;
        if (targetUserId && candidate) {
          console.log(`[Socket Calling] Forwarding ice_candidate from ${userId} to user:${targetUserId}`);
          io.to(`user:${targetUserId}`).emit('ice_candidate', {
            callId,
            senderUserId: userId,
            candidate,
          });
        }
      } catch (err: any) {
        console.error('Socket ice_candidate error:', err);
      }
    });

    // Helper to persist system call log message to MongoDB & broadcast new_message event
    const saveCallLogMessage = async (params: {
      chatId?: string;
      senderId: string;
      recipientId: string;
      callId: string;
      isVideo: boolean;
      callStatus: 'accepted' | 'declined' | 'missed';
      durationSeconds?: number;
    }) => {
      try {
        const { chatId, senderId, recipientId, callId, isVideo, callStatus, durationSeconds = 0 } = params;

        let targetChatId = chatId;
        if (!targetChatId && mongoose.connection.readyState === 1) {
          const existingChat = await Chat.findOne({
            isGroup: false,
            participants: { $all: [senderId, recipientId] },
          });
          if (existingChat) {
            targetChatId = existingChat._id.toString();
          }
        }

        if (!targetChatId) return;

        let text = '';
        const icon = isVideo ? '🎥' : '📞';
        const callTypeStr = isVideo ? 'Video call' : 'Voice call';

        if (callStatus === 'accepted') {
          const mins = Math.floor(durationSeconds / 60);
          const secs = durationSeconds % 60;
          const formatted = `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
          text = `${icon} ${callTypeStr} (${formatted})`;
        } else if (callStatus === 'declined') {
          text = `${icon} Declined ${callTypeStr.toLowerCase()}`;
        } else {
          text = `${icon} Missed ${callTypeStr.toLowerCase()}`;
        }

        const message = new Message({
          chat: targetChatId,
          sender: senderId,
          text,
          status: 'sent',
          mediaType: 'call_log',
          mediaDuration: durationSeconds,
          callMetadata: {
            callId,
            isVideo,
            callStatus,
            durationSeconds,
            recipientId,
          },
        });

        if (mongoose.connection.readyState === 1) {
          await message.save();
          const populated = await message.populate([
            { path: 'sender', select: 'displayName avatarUrl status' },
          ]);

          const chat = await Chat.findById(targetChatId);
          if (chat) {
            chat.lastMessage = message._id as any;
            await chat.save();
          }

          io.to(`active_chat:${targetChatId}`).emit('new_message', populated);
          io.to(`user:${senderId}`).emit('new_message', populated);
          io.to(`user:${recipientId}`).emit('new_message', populated);
        }
      } catch (err) {
        console.error('Error saving call log message:', err);
      }
    };

    // Handle explicit client save_call_log
    socket.on('save_call_log', async (data: {
      chatId?: string;
      recipientId: string;
      callId: string;
      isVideo: boolean;
      callStatus: 'accepted' | 'declined' | 'missed';
      durationSeconds?: number;
    }) => {
      await saveCallLogMessage({
        ...(data.chatId ? { chatId: data.chatId } : {}),
        senderId: userId,
        recipientId: data.recipientId,
        callId: data.callId,
        isVideo: data.isVideo,
        callStatus: data.callStatus,
        durationSeconds: data.durationSeconds || 0,
      });
    });

    // Handle call_reject (Recipient -> Server -> Caller)
    socket.on('call_reject', async (data: {
      callId: string;
      callerId: string;
      isVideo?: boolean;
      chatId?: string;
      reason?: string;
    }) => {
      try {
        const { callId, callerId, isVideo = false, chatId, reason } = data;
        if (callerId) {
          io.to(`user:${callerId}`).emit('call_reject', {
            callId,
            recipientId: userId,
            reason: reason || 'declined',
          });

          // Log call rejection in chat thread
          await saveCallLogMessage({
            ...(chatId ? { chatId } : {}),
            senderId: callerId,
            recipientId: userId,
            callId,
            isVideo,
            callStatus: reason === 'busy' ? 'missed' : 'declined',
            durationSeconds: 0,
          });
        }
      } catch (err: any) {

        console.error('Socket call_reject error:', err);
      }
    });

    // Handle call_end (Either party -> Server -> Peer)
    socket.on('call_end', (data: {
      callId: string;
      targetUserId: string;
      reason?: string;
    }) => {
      try {
        const { callId, targetUserId, reason } = data;
        if (targetUserId) {
          io.to(`user:${targetUserId}`).emit('call_end', {
            callId,
            endedBy: userId,
            reason: reason || 'ended',
          });
        }
      } catch (err: any) {
        console.error('Socket call_end error:', err);
      }
    });


    socket.on('disconnect', async () => {
      console.log(`Socket client disconnected: ${userId}`);
      let shouldBroadcastOffline = true;
      const lastSeenDate = new Date();

      if (redisClient) {
        try {
          const connKey = `user:connections:${userId}`;
          const presenceKey = `user:presence:${userId}`;
          const remainingConnections = await redisClient.decr(connKey);
          
          if (remainingConnections <= 0) {
            await redisClient.del(connKey);
            await redisClient.del(presenceKey);
          } else {
            shouldBroadcastOffline = false;
          }
        } catch (err) {
          console.error('Redis presence disconnect error:', err);
        }
      }

      if (shouldBroadcastOffline) {
        try {
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: lastSeenDate });
        } catch (err) {
          console.error('Error updating DB offline status on disconnect:', err);
        }

        try {
          const currentChats = await Chat.find({ participants: userId, deletedForUsers: { $ne: userId } });
          for (const chat of currentChats) {
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
        } catch (err) {
          console.error('Error broadcasting offline presence change:', err);
        }
      }
    });
  });
}
