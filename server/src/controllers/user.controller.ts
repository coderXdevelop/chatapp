import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import Report from '../models/Report.js';

export async function blockUser(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { targetUserId } = req.params;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!targetUserId) return res.status(400).json({ message: 'Target user ID is required' });
  if (userId === targetUserId) {
    return res.status(400).json({ message: 'You cannot block yourself' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: 'User to block not found' });

    // Add to blocked list if not present
    if (!user.blockedUsers.includes(targetUserId as any)) {
      user.blockedUsers.push(targetUserId as any);
      await user.save();
    }

    const updatedUser = await User.findById(userId).populate('blockedUsers', 'displayName email avatarUrl status connectId');
    return res.status(200).json({ blockedUsers: updatedUser?.blockedUsers || [] });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error blocking user', error: error.message });
  }
}

export async function unblockUser(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { targetUserId } = req.params;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!targetUserId) return res.status(400).json({ message: 'Target user ID is required' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.blockedUsers = user.blockedUsers.filter((id) => id.toString() !== targetUserId);
    await user.save();

    const updatedUser = await User.findById(userId).populate('blockedUsers', 'displayName email avatarUrl status connectId');
    return res.status(200).json({ blockedUsers: updatedUser?.blockedUsers || [] });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error unblocking user', error: error.message });
  }
}

export async function getBlockedUsers(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const user = await User.findById(userId).populate('blockedUsers', 'displayName email avatarUrl status connectId');
    return res.status(200).json({ blockedUsers: user?.blockedUsers || [] });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error retrieving blocked users', error: error.message });
  }
}

export async function reportUserOrChat(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { reportedUserId, reportedChatId, category, reason } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!category || !reason) {
    return res.status(400).json({ message: 'Category and reason are required' });
  }

  if (!reportedUserId && !reportedChatId) {
    return res.status(400).json({ message: 'Either reportedUserId or reportedChatId must be provided' });
  }

  if (reason.length > 500) {
    return res.status(400).json({ message: 'Report reason details cannot exceed 500 characters' });
  }

  try {
    const report = new Report({
      reporter: userId,
      reportedUser: reportedUserId || undefined,
      reportedChat: reportedChatId || undefined,
      category,
      reason: reason.trim(),
    });

    await report.save();
    return res.status(201).json({ success: true, message: 'Report submitted successfully' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error submitting report', error: error.message });
  }
}

export async function toggleNotifications(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { enabled } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (enabled === undefined) return res.status(400).json({ message: 'enabled boolean is required' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.notificationsEnabled = !!enabled;
    await user.save();

    return res.status(200).json({ success: true, notificationsEnabled: user.notificationsEnabled });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error toggling notifications', error: error.message });
  }
}

export async function toggleChatMute(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  const { chatId } = req.params;
  const { mute } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!chatId) return res.status(400).json({ message: 'chatId parameter is required' });
  if (mute === undefined) return res.status(400).json({ message: 'mute boolean is required' });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const chatIndex = user.mutedChats?.findIndex((id) => id.toString() === chatId);

    if (mute) {
      if (chatIndex === -1 || chatIndex === undefined) {
        if (!user.mutedChats) user.mutedChats = [];
        user.mutedChats.push(chatId as any);
      }
    } else {
      if (chatIndex !== -1 && chatIndex !== undefined) {
        user.mutedChats = user.mutedChats.filter((id) => id.toString() !== chatId);
      }
    }

    await user.save();
    return res.status(200).json({ success: true, mutedChats: user.mutedChats || [] });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error toggling mute status', error: error.message });
  }
}
