import { Server } from 'socket.io';
import type { AuthenticatedSocket } from './socket.js';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';
import { sendCallPushNotification } from '../services/push.service.js';

// In-memory active calls map: userId -> active callId
const activeUserCalls = new Map<string, { callId: string; peerId: string; isVideo: boolean; startedAt?: number }>();

export function setupCallingSockets(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.user?.userId;
  if (!userId) return;

  /**
   * Helper to persist call history into the chat stream as a call_log message
   */
  const saveCallLogMessage = async (params: {
    chatId?: string | undefined;
    senderId: string;
    recipientId: string;
    callId: string;
    isVideo: boolean;
    callStatus: 'accepted' | 'declined' | 'missed' | 'busy' | 'cancelled';
    durationSeconds?: number | undefined;
  }) => {
    try {
      const { senderId, recipientId, callId, isVideo, callStatus, durationSeconds = 0 } = params;
      let targetChatId = params.chatId;

      // Find or locate 1:1 chat if chatId is not explicitly passed
      if (!targetChatId && mongoose.connection.readyState === 1) {
        const chat = await Chat.findOne({
          isGroup: false,
          participants: { $all: [senderId, recipientId] },
        });
        if (chat) {
          targetChatId = chat._id.toString();
        }
      }

      if (!targetChatId) return;

      const icon = isVideo ? '📹' : '📞';
      const callTypeStr = isVideo ? 'Video Call' : 'Voice Call';
      let text = `${icon} ${callTypeStr}`;

      if (callStatus === 'accepted') {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        const formattedDur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        text = `${icon} ${callTypeStr} (${formattedDur})`;
      } else if (callStatus === 'declined') {
        text = `${icon} Declined ${callTypeStr.toLowerCase()}`;
      } else if (callStatus === 'busy') {
        text = `${icon} Busy - Call unanswered`;
      } else if (callStatus === 'cancelled') {
        text = `${icon} Cancelled ${callTypeStr.toLowerCase()}`;
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
      console.error('[CallingSocket] Error saving call log:', err);
    }
  };

  /**
   * 1. EVENT: call-user
   * Caller initiates call to recipient.
   */
  socket.on('call-user', async (data: {
    callId: string;
    recipientId: string;
    isVideo: boolean;
    chatId?: string;
  }) => {
    try {
      const { callId, recipientId, isVideo, chatId } = data;
      console.log(`[CallingSocket] call-user initiated by ${userId} to ${recipientId} (CallID: ${callId})`);

      // Check if recipient is already in a call
      if (activeUserCalls.has(recipientId)) {
        console.log(`[CallingSocket] User ${recipientId} is currently busy`);
        socket.emit('user-busy', { callId, recipientId, isVideo });
        await saveCallLogMessage({
          chatId,
          senderId: userId,
          recipientId,
          callId,
          isVideo,
          callStatus: 'busy',
          durationSeconds: 0,
        });
        return;
      }

      // Track caller state
      activeUserCalls.set(userId, { callId, peerId: recipientId, isVideo });

      // Fetch caller information
      let callerName = 'User';
      let callerAvatar = '';
      if (mongoose.connection.readyState === 1) {
        const callerUser = await User.findById(userId).select('displayName avatarUrl');
        if (callerUser) {
          callerName = callerUser.displayName || 'User';
          callerAvatar = callerUser.avatarUrl || '';
        }
      }

      // Send incoming call event to recipient socket room
      io.to(`user:${recipientId}`).emit('incoming-call', {
        callId,
        callerId: userId,
        callerName,
        callerAvatar,
        isVideo,
        chatId,
      });

      // Send background Push Notification to recipient
      sendCallPushNotification(recipientId, {
        callerName,
        callId,
        callerId: userId,
        isVideo,
        ...(chatId ? { chatId } : {}),
      }).catch((e) => console.error('[CallingSocket] Push notification error:', e));

    } catch (err) {
      console.error('[CallingSocket] Error in call-user:', err);
    }
  });

  /**
   * 2. EVENT: accept-call
   * Recipient accepts call.
   */
  socket.on('accept-call', (data: {
    callId: string;
    callerId: string;
    isVideo: boolean;
  }) => {
    try {
      const { callId, callerId, isVideo } = data;
      console.log(`[CallingSocket] accept-call from ${userId} to caller ${callerId}`);

      // Mark both users as active in call
      const now = Date.now();
      activeUserCalls.set(userId, { callId, peerId: callerId, isVideo, startedAt: now });
      const callerState = activeUserCalls.get(callerId);
      if (callerState) {
        callerState.startedAt = now;
      }

      io.to(`user:${callerId}`).emit('accept-call', {
        callId,
        recipientId: userId,
        isVideo,
      });
    } catch (err) {
      console.error('[CallingSocket] Error in accept-call:', err);
    }
  });

  /**
   * 3. EVENT: reject-call
   * Recipient rejects call.
   */
  socket.on('reject-call', async (data: {
    callId: string;
    callerId: string;
    isVideo: boolean;
    chatId?: string;
    reason?: string;
  }) => {
    try {
      const { callId, callerId, isVideo, chatId, reason = 'declined' } = data;
      console.log(`[CallingSocket] reject-call by ${userId} for call ${callId}`);

      activeUserCalls.delete(userId);
      activeUserCalls.delete(callerId);

      io.to(`user:${callerId}`).emit('reject-call', {
        callId,
        recipientId: userId,
        reason,
      });

      await saveCallLogMessage({
        chatId,
        senderId: callerId,
        recipientId: userId,
        callId,
        isVideo,
        callStatus: 'declined',
        durationSeconds: 0,
      });
    } catch (err) {
      console.error('[CallingSocket] Error in reject-call:', err);
    }
  });

  /**
   * 4. EVENT: cancel-call
   * Caller cancels call before recipient answers.
   */
  socket.on('cancel-call', async (data: {
    callId: string;
    recipientId: string;
    isVideo: boolean;
    chatId?: string;
  }) => {
    try {
      const { callId, recipientId, isVideo, chatId } = data;
      console.log(`[CallingSocket] cancel-call by caller ${userId} for call ${callId}`);

      activeUserCalls.delete(userId);
      activeUserCalls.delete(recipientId);

      io.to(`user:${recipientId}`).emit('cancel-call', {
        callId,
        callerId: userId,
      });

      await saveCallLogMessage({
        chatId,
        senderId: userId,
        recipientId,
        callId,
        isVideo,
        callStatus: 'cancelled',
        durationSeconds: 0,
      });
    } catch (err) {
      console.error('[CallingSocket] Error in cancel-call:', err);
    }
  });

  /**
   * 5. EVENT: end-call
   * Either participant ends an ongoing call.
   */
  socket.on('end-call', async (data: {
    callId: string;
    targetUserId: string;
    isVideo: boolean;
    chatId?: string;
    durationSeconds?: number;
  }) => {
    try {
      const { callId, targetUserId, isVideo, chatId, durationSeconds = 0 } = data;
      console.log(`[CallingSocket] end-call by ${userId} with target ${targetUserId}`);

      const userCall = activeUserCalls.get(userId);
      let calculatedDuration = durationSeconds;

      if (userCall && userCall.startedAt) {
        calculatedDuration = Math.max(calculatedDuration, Math.floor((Date.now() - userCall.startedAt) / 1000));
      }

      activeUserCalls.delete(userId);
      activeUserCalls.delete(targetUserId);

      io.to(`user:${targetUserId}`).emit('end-call', {
        callId,
        endedBy: userId,
        durationSeconds: calculatedDuration,
      });

      await saveCallLogMessage({
        chatId,
        senderId: userId,
        recipientId: targetUserId,
        callId,
        isVideo,
        callStatus: 'accepted',
        durationSeconds: calculatedDuration,
      });
    } catch (err) {
      console.error('[CallingSocket] Error in end-call:', err);
    }
  });

  /**
   * 6. EVENT: offer
   * Relays SDP offer to remote peer.
   */
  socket.on('offer', (data: {
    callId: string;
    targetUserId: string;
    sdp: any;
    isVideo: boolean;
  }) => {
    const { callId, targetUserId, sdp, isVideo } = data;
    io.to(`user:${targetUserId}`).emit('offer', {
      callId,
      senderId: userId,
      sdp,
      isVideo,
    });
  });

  /**
   * 7. EVENT: answer
   * Relays SDP answer back to caller.
   */
  socket.on('answer', (data: {
    callId: string;
    targetUserId: string;
    sdp: any;
  }) => {
    const { callId, targetUserId, sdp } = data;
    io.to(`user:${targetUserId}`).emit('answer', {
      callId,
      senderId: userId,
      sdp,
    });
  });

  /**
   * 8. EVENT: ice-candidate
   * Relays ICE Candidate trickling to peer.
   */
  socket.on('ice-candidate', (data: {
    callId: string;
    targetUserId: string;
    candidate: any;
  }) => {
    const { callId, targetUserId, candidate } = data;
    io.to(`user:${targetUserId}`).emit('ice-candidate', {
      callId,
      senderId: userId,
      candidate,
    });
  });

  /**
   * 9. EVENT: call-timeout
   * Call ringing timed out without answer (e.g. 30s timeout).
   */
  socket.on('call-timeout', async (data: {
    callId: string;
    recipientId: string;
    isVideo: boolean;
    chatId?: string;
  }) => {
    try {
      const { callId, recipientId, isVideo, chatId } = data;
      console.log(`[CallingSocket] call-timeout for call ${callId}`);

      activeUserCalls.delete(userId);
      activeUserCalls.delete(recipientId);

      io.to(`user:${recipientId}`).emit('call-timeout', {
        callId,
        callerId: userId,
      });

      await saveCallLogMessage({
        chatId,
        senderId: userId,
        recipientId,
        callId,
        isVideo,
        callStatus: 'missed',
        durationSeconds: 0,
      });
    } catch (err) {
      console.error('[CallingSocket] Error in call-timeout:', err);
    }
  });

  /**
   * 10. EVENT: reconnect-call
   * WebRTC renegotiation / ICE restart request during active call.
   */
  socket.on('reconnect-call', (data: {
    callId: string;
    targetUserId: string;
    reason?: string;
  }) => {
    const { callId, targetUserId, reason } = data;
    io.to(`user:${targetUserId}`).emit('reconnect-call', {
      callId,
      senderId: userId,
      reason: reason || 'network_switch',
    });
  });

  /**
   * Teardown active call state if socket disconnects abruptly
   */
  socket.on('disconnect', () => {
    const callState = activeUserCalls.get(userId);
    if (callState) {
      const { callId, peerId, isVideo, startedAt } = callState;
      activeUserCalls.delete(userId);
      activeUserCalls.delete(peerId);

      const duration = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      io.to(`user:${peerId}`).emit('end-call', {
        callId,
        endedBy: userId,
        reason: 'network_disconnected',
        durationSeconds: duration,
      });
    }
  });
}
