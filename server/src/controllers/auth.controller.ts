import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import { sendOTPEmail } from '../services/email.service.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/jwt.service.js';
import { generateOTP, storeOTP, verifyOTP } from '../services/otp.service.js';

export async function sendOTP(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otp = generateOTP();

    await storeOTP(normalizedEmail, otp, 300);
    await sendOTPEmail(normalizedEmail, otp);

    return res.status(200).json({
      message: 'Verification code sent successfully to your email.',
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ message: error.message || 'Failed to send verification code' });
  }
}

export async function verifyOTPHandler(req: Request, res: Response) {
  try {
    const { email, otp, displayName } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isValid = await verifyOTP(normalizedEmail, otp.trim());

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const defaultName = displayName?.trim() || normalizedEmail.split('@')[0] || 'ChatConnect User';
      user = await User.create({
        email: normalizedEmail,
        displayName: defaultName,
        status: 'Hey there! I am using ChatConnect.',
      });
    } else if (displayName && displayName.trim() && user.displayName !== displayName.trim()) {
      user.displayName = displayName.trim();
      await user.save();
    }

    const payload = { userId: (user._id as any).toString(), email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      message: 'Authentication successful',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ message: error.message || 'Authentication failed' });
  }
}

export async function refreshSession(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newPayload = { userId: (user._id as any).toString(), email: user.email };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    return res.status(200).json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch user profile' });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { displayName, status, avatarUrl } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (status !== undefined) user.status = status;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to update profile' });
  }
}
