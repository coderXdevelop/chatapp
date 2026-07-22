import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import User from '../models/User.js';
import { deleteAvatar, uploadAvatar } from '../services/cloudinary.service.js';
import { sendOTPEmail } from '../services/email.service.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../services/jwt.service.js';
import { generateOTP, storeOTP, verifyOTP } from '../services/otp.service.js';

/**
 * Register Step 1: Initialize Registration & Send OTP
 */
export async function registerInit(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Valid email address is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Invalid email address format' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists. Please sign in instead.' });
    }

    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 300);
    await sendOTPEmail(normalizedEmail, otp);

    return res.status(200).json({
      message: 'Verification code sent to your email.',
    });
  } catch (error: any) {
    console.error('Register init error:', error);
    return res.status(500).json({ message: error.message || 'Failed to initialize registration' });
  }
}

/**
 * Register Step 2: Verify Registration OTP
 */
export async function verifyRegisterOTP(req: Request, res: Response) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isValid = await verifyOTP(normalizedEmail, otp.trim());

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    return res.status(200).json({
      message: 'OTP verified successfully.',
      verified: true,
    });
  } catch (error: any) {
    console.error('Verify registration OTP error:', error);
    return res.status(500).json({ message: error.message || 'OTP verification failed' });
  }
}

/**
 * Register Step 3: Complete Registration & Build Profile
 */
export async function completeRegistration(req: Request, res: Response) {
  try {
    const { email, password, displayName, age, status, avatarUrl } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required to complete registration' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      return res.status(400).json({ message: 'User already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData: any = {
      email: normalizedEmail,
      password: hashedPassword,
      displayName: displayName?.trim() || normalizedEmail.split('@')[0] || 'ChatConnect User',
      status: status?.trim() || 'Hey there! I am using ChatConnect.',
      avatarUrl: '',
      avatarPublicId: '',
    };
    if (age !== undefined && age !== '' && age !== null) {
      userData.age = Number(age);
    }

    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
      try {
        const uploaded = await uploadAvatar(avatarUrl.trim());
        userData.avatarUrl = uploaded.url;
        userData.avatarPublicId = uploaded.publicId;
      } catch (e) {
        console.warn('Failed to upload avatar during registration, proceeding without avatar:', e);
      }
    }

    user = await User.create(userData);

    const payload = { userId: (user._id as any).toString(), email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(201).json({
      message: 'Registration successful',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        age: user.age,
        status: user.status,
        avatarUrl: user.avatarUrl,
        avatarPublicId: user.avatarPublicId,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Complete registration error:', error);
    return res.status(500).json({ message: error.message || 'Failed to complete registration' });
  }
}

/**
 * Login with Email and Password
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Password not set for this account. Please use OTP login or re-register.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const payload = { userId: (user._id as any).toString(), email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return res.status(200).json({
      message: 'Login successful',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        age: user.age,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: error.message || 'Login failed' });
  }
}

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
        age: user.age,
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
        age: user.age,
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
    const { displayName, age, status, avatarUrl } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (age !== undefined) {
      user.age = (age !== '' && age !== null) ? Number(age) : undefined;
    }
    if (status !== undefined) user.status = status;

    if (avatarUrl !== undefined && avatarUrl !== user.avatarUrl) {
      if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
        // Delete old avatar from Cloudinary if it exists
        if (user.avatarPublicId) {
          await deleteAvatar(user.avatarPublicId);
        }
        // Upload new avatar to Cloudinary
        const uploaded = await uploadAvatar(avatarUrl.trim());
        user.avatarUrl = uploaded.url;
        user.avatarPublicId = uploaded.publicId;
      }
    }

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        age: user.age,
        status: user.status,
        avatarUrl: user.avatarUrl,
        avatarPublicId: user.avatarPublicId,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
}

export async function removeAvatar(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.avatarPublicId) {
      await deleteAvatar(user.avatarPublicId);
    }

    user.avatarUrl = '';
    user.avatarPublicId = '';
    await user.save();

    return res.status(200).json({
      message: 'Avatar removed successfully',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        age: user.age,
        status: user.status,
        avatarUrl: user.avatarUrl,
        avatarPublicId: user.avatarPublicId,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Remove avatar error:', error);
    return res.status(500).json({ message: 'Failed to remove avatar' });
  }
}

/**
 * Forgot Password: Verify email exists and send OTP
 */
export async function forgotPassword(req: Request, res: Response) {
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
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    const otp = generateOTP();
    await storeOTP(normalizedEmail, otp, 300);
    await sendOTPEmail(normalizedEmail, otp);

    return res.status(200).json({
      message: 'Verification code sent successfully to your email.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: error.message || 'Failed to request password reset' });
  }
}

/**
 * Reset Password: Verify OTP and update password
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isValid = await verifyOTP(normalizedEmail, otp.trim());

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: 'Password reset successfully. You can now login.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: error.message || 'Failed to reset password' });
  }
}


