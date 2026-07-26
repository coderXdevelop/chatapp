import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import Status from '../models/Status.js';
import Chat from '../models/Chat.js';

export async function createStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { items, text, mediaUrl, mediaType, caption, backgroundColor } = req.body;

    if (Array.isArray(items) && items.length > 0) {
      const statusDocs = items.map((item: any) => ({
        user: userId,
        text: item.text || '',
        mediaUrl: item.mediaUrl || null,
        mediaType: item.mediaType || null,
        caption: item.caption || '',
        backgroundColor: item.backgroundColor || '#0F172A',
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
    const statuses = await Status.find({
      user: { $in: contactIds as any[] },
      createdAt: { $gte: twentyFourHoursAgo },
    })
      .sort({ createdAt: 1 })
      .populate('user', 'displayName avatarUrl email connectId');

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
