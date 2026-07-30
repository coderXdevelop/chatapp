import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';

export async function getCallLogs(req: AuthenticatedRequest, res: Response) {

  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find all chats where the user is a participant
    const userChats = await Chat.find({ participants: userId, deletedForUsers: { $ne: userId } }).select('_id participants');
    const chatIds = userChats.map((c) => c._id);

    // Query messages with mediaType 'call_log'
    const callMessages = await Message.find({
      chat: { $in: chatIds },
      mediaType: 'call_log',
      deletedForUsers: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'displayName avatarUrl email')
      .populate('chat', 'participants');

    // Format logs for client display
    const logs = callMessages.map((msg: any) => {
      const isCaller = msg.sender?._id?.toString() === userId;
      
      // Find peer (other participant in 1:1 chat)
      const chatParticipants = msg.chat?.participants || [];
      const peer = chatParticipants.find((p: any) => p._id?.toString() !== userId) || msg.sender;

      return {
        _id: msg._id,
        callId: msg.callMetadata?.callId || msg._id.toString(),
        chatId: msg.chat?._id || msg.chat,
        isCaller,
        peer: {
          _id: peer._id,
          displayName: peer.displayName || 'User',
          avatarUrl: peer.avatarUrl,
        },
        isVideo: !!msg.callMetadata?.isVideo,
        callStatus: msg.callMetadata?.callStatus || 'accepted',
        durationSeconds: msg.mediaDuration || msg.callMetadata?.durationSeconds || 0,
        text: msg.text,
        createdAt: msg.createdAt,
      };
    });

    return res.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error fetching call logs:', error);
    return res.status(500).json({ error: 'Failed to fetch call logs' });
  }
}
