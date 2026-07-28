import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import Status from '../models/Status.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Message from '../models/Message.js';

export async function createStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const userObj = await User.findById(userId);
    const privacy = userObj?.statusPrivacy || { type: 'contacts', excludedUsers: [], includedUsers: [] };

    let allowedUsers: any[] | null = null;

    if (privacy.type === 'except') {
      const userChats = await Chat.find({ participants: userId as any });
      const contactIdsSet = new Set<string>();
      userChats.forEach((chat) => {
        chat.participants.forEach((pId) => {
          if (pId.toString() !== userId.toString()) {
            contactIdsSet.add(pId.toString());
          }
        });
      });
      const excludedSet = new Set(privacy.excludedUsers.map((id) => id.toString()));
      allowedUsers = Array.from(contactIdsSet).filter((id) => !excludedSet.has(id));
    } else if (privacy.type === 'only') {
      allowedUsers = privacy.includedUsers.map((id) => id.toString());
    } else {
      allowedUsers = null; // Standard contacts access
    }

    const { items, text, mediaUrl, mediaType, caption, backgroundColor } = req.body;

    if (Array.isArray(items) && items.length > 0) {
      const statusDocs = items.map((item: any) => ({
        user: userId,
        text: item.text || '',
        mediaUrl: item.mediaUrl || null,
        mediaType: item.mediaType || null,
        caption: item.caption || '',
        backgroundColor: item.backgroundColor || '#0F172A',
        allowedUsers,
      }));

      const created = await Status.insertMany(statusDocs);
      return res.status(201).json({ message: 'Statuses posted successfully', statuses: created });
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ message: 'Status must contain text or media' });
    }

    const newStatus = new Status({
      user: userId,
      text: text || '',
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      caption: caption || '',
      backgroundColor: backgroundColor || '#0F172A',
      allowedUsers,
    });

    await newStatus.save();

    const populated = await newStatus.populate('user', 'displayName avatarUrl email connectId');

    return res.status(201).json({ message: 'Status posted successfully', status: populated });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to post status', error: error.message });
  }
}

export async function getStatusFeed(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Find contacts (participants of all user chats)
    const userChats = await Chat.find({ participants: userId as any });
    const contactIdsSet = new Set<string>();
    contactIdsSet.add(userId.toString()); // Include current user's status

    userChats.forEach((chat) => {
      chat.participants.forEach((pId) => contactIdsSet.add(pId.toString()));
    });

    const contactIds = Array.from(contactIdsSet);

    // Fetch active status updates created in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rawStatuses = await Status.find({
      user: { $in: contactIds as any[] },
      createdAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ createdAt: 1 })
      .populate('user', 'displayName avatarUrl email connectId')
      .populate('views.user', 'displayName avatarUrl email connectId');

    // Filter statuses based on privacy permissions
    const statuses = rawStatuses.filter((st) => {
      const authorId = (st.user as any)?._id?.toString() || st.user.toString();
      if (authorId === userId.toString()) return true;

      // Check allowedUsers privacy filter
      if (st.allowedUsers && Array.isArray(st.allowedUsers)) {
        return st.allowedUsers.some((uId) => uId.toString() === userId.toString());
      }
      return true;
    });

    // Group statuses by user ID
    const groupedByUser: Record<string, { user: any; items: any[] }> = {};

    statuses.forEach((st) => {
      const u = st.user as any;
      if (!u || !u._id) return;
      const uId = u._id.toString();
      if (!groupedByUser[uId]) {
        groupedByUser[uId] = {
          user: u,
          items: [],
        };
      }
      groupedByUser[uId].items.push(st);
    });

    const feed = Object.values(groupedByUser);

    return res.status(200).json({ feed });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch status feed', error: error.message });
  }
}

export async function recordStatusView(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const status = await Status.findById(id);
    if (!status) return res.status(404).json({ message: 'Status not found' });

    const authorId = status.user.toString();

    // If viewer is NOT the author, record view
    if (authorId !== userId.toString()) {
      const existingViewIndex = status.views.findIndex((v) => v.user.toString() === userId.toString());

      if (existingViewIndex === -1) {
        status.views.push({
          user: userId as any,
          viewedAt: new Date(),
        });
        await status.save();
      }
    }

    return res.status(200).json({ success: true, viewCount: status.views.length });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to record view', error: error.message });
  }
}

export async function reactToStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { emoji } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!emoji) return res.status(400).json({ message: 'Emoji is required' });

    const status = await Status.findById(id);
    if (!status) return res.status(404).json({ message: 'Status not found' });

    const authorId = status.user.toString();
    const currentUser = await User.findById(userId, 'displayName avatarUrl email connectId');

    if (authorId !== userId.toString()) {
      const existingViewIndex = status.views.findIndex((v) => v.user.toString() === userId.toString());

      if (existingViewIndex > -1 && status.views[existingViewIndex]) {
        status.views[existingViewIndex].reaction = emoji;
        status.views[existingViewIndex].viewedAt = new Date();
      } else {
        status.views.push({
          user: userId as any,
          reaction: emoji,
          viewedAt: new Date(),
        });
      }

      await status.save();

      // Emit socket event to status owner if online
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${authorId}`).emit('status_reacted', {
          statusId: status._id.toString(),
          user: currentUser,
          emoji,
        });
      }
    }

    return res.status(200).json({ success: true, emoji });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to react to status', error: error.message });
  }
}

export async function getStatusViewers(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const status = await Status.findById(id).populate('views.user', 'displayName avatarUrl email connectId');
    if (!status) return res.status(404).json({ message: 'Status not found' });

    if (status.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only status owner can view status viewers' });
    }

    return res.status(200).json({ viewers: status.views || [] });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch status viewers', error: error.message });
  }
}

export async function replyToStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { text } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!text || !text.trim()) return res.status(400).json({ message: 'Reply text cannot be empty' });

    const status = await Status.findById(id).populate('user', 'displayName avatarUrl email connectId');
    if (!status) return res.status(404).json({ message: 'Status not found' });

    const statusOwnerId = (status.user as any)._id.toString();
    if (statusOwnerId === userId.toString()) {
      return res.status(400).json({ message: 'You cannot reply to your own status' });
    }

    // Find or create direct 1:1 chat
    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [userId, statusOwnerId] },
    }).populate('participants', 'displayName email avatarUrl status connectId isOnline lastSeen');

    if (!chat) {
      chat = new Chat({
        participants: [userId, statusOwnerId],
        isGroup: false,
      });
      await chat.save();
      chat = await Chat.findById(chat._id).populate('participants', 'displayName email avatarUrl status connectId isOnline lastSeen');
    }

    if (!chat) {
      return res.status(500).json({ message: 'Failed to create or retrieve chat' });
    }

    const message = new Message({
      chat: chat._id,
      sender: userId,
      text: text.trim(),
      status: 'sent',
      statusReply: {
        statusId: status._id,
        mediaUrl: status.mediaUrl,
        mediaType: status.mediaType,
        text: status.text,
        caption: status.caption,
        backgroundColor: status.backgroundColor,
        statusOwner: (status.user as any)._id,
      },
    });

    await message.save();
    const populatedMessage = await message.populate('sender', 'displayName avatarUrl email connectId');

    chat.lastMessage = populatedMessage._id as any;
    chat.updatedAt = populatedMessage.createdAt;
    await chat.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chat._id}`).emit('new_message', populatedMessage);
      io.to(`user:${statusOwnerId}`).emit('new_message', populatedMessage);
      io.to(`user:${userId}`).emit('new_message', populatedMessage);
    }

    return res.status(201).json({ message: populatedMessage, chat });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to reply to status', error: error.message });
  }
}

export async function deleteStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const status = await Status.findOne({ _id: id as any, user: userId as any });
    if (!status) {
      return res.status(404).json({ message: 'Status not found or unauthorized' });
    }

    await status.deleteOne();
    return res.status(200).json({ message: 'Status deleted successfully', id });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to delete status', error: error.message });
  }
}
