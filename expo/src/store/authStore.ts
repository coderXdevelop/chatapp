import { create } from 'zustand';
import { api } from '../services/api';
import { getItem, removeItem, setItem } from '../services/storage';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  age?: number;
  status: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  createdAt?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  registerInit: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  completeRegistration: (data: {
    email: string;
    password: string;
    displayName: string;
    age?: number;
    status?: string;
    avatarUrl?: string;
  }) => Promise<boolean>;
  sendOtp: (email: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (email: string, otp: string, displayName?: string) => Promise<boolean>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { displayName?: string; age?: number; status?: string; avatarUrl?: string }) => Promise<boolean>;
  removeAvatar: () => Promise<boolean>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, refreshToken, user } = response.data;
      await setItem('access_token', token);
      if (refreshToken) {
        await setItem('refresh_token', refreshToken);
      }
      set({ user, token, isLoading: false, isInitialized: true });
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Login failed. Please check your credentials.';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  registerInit: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/register-init', { email, password });
      set({ isLoading: false });
      return { success: true, message: response.data.message };
    } catch (error: any) {
      console.error('Register init error:', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Failed to initialize registration.';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  verifyRegisterOtp: async (email: string, otp: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/verify-register-otp', { email, otp });
      set({ isLoading: false });
      return { success: true, message: response.data.message };
    } catch (error: any) {
      console.error('Verify register OTP error:', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Invalid or expired OTP code.';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  completeRegistration: async (data) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/complete-registration', data);
      const { token, refreshToken, user } = response.data;
      await setItem('access_token', token);
      if (refreshToken) {
        await setItem('refresh_token', refreshToken);
      }
      set({ user, token, isLoading: false, isInitialized: true });
      return true;
    } catch (error: any) {
      console.error('Complete registration error:', error?.response?.data || error.message);
      set({ isLoading: false });
      return false;
    }
  },

  sendOtp: async (email: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/send-otp', { email });
      set({ isLoading: false });
      return { success: true, message: response.data.message };
    } catch (error: any) {
      console.error('Send OTP error:', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Failed to send OTP code.';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  forgotPassword: async (email: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/forgot-password', { email });
      set({ isLoading: false });
      return { success: true, message: response.data.message };
    } catch (error: any) {
      console.error('Forgot password error:', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Failed to request password reset.';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/reset-password', { email, otp, newPassword });
      set({ isLoading: false });
      return { success: true, message: response.data.message };
    } catch (error: any) {
      console.error('Reset password error:', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Failed to reset password.';
      set({ isLoading: false });
      return { success: false, message: msg };
    }
  },

  verifyOtp: async (email: string, otp: string, displayName?: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/verify-otp', {
        email,
        otp,
        displayName,
      });

      const { token, refreshToken, user } = response.data;
      await setItem('access_token', token);
      if (refreshToken) {
        await setItem('refresh_token', refreshToken);
      }

      set({ user, token, isLoading: false, isInitialized: true });
      return true;
    } catch (error: any) {
      console.error('Verify OTP error:', error?.response?.data || error.message);
      set({ isLoading: false });
      return false;
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await getItem('access_token');
      if (!token) {
        set({ user: null, token: null, isLoading: false, isInitialized: true });
        return;
      }

      const response = await api.get('/api/auth/me');
      set({ user: response.data.user, token, isLoading: false, isInitialized: true });
    } catch (error) {
      // Try refresh token if available
      try {
        const refreshToken = await getItem('refresh_token');
        if (refreshToken) {
          const refreshRes = await api.post('/api/auth/refresh', { refreshToken });
          const newToken = refreshRes.data.token;
          await setItem('access_token', newToken);
          if (refreshRes.data.refreshToken) {
            await setItem('refresh_token', refreshRes.data.refreshToken);
          }
          const meRes = await api.get('/api/auth/me');
          set({ user: meRes.data.user, token: newToken, isLoading: false, isInitialized: true });
          return;
        }
      } catch (e) {
        console.error('Refresh token failed:', e);
      }

      await removeItem('access_token');
      await removeItem('refresh_token');
      set({ user: null, token: null, isLoading: false, isInitialized: true });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    try {
      const response = await api.put('/api/auth/profile', data);
      set({ user: response.data.user, isLoading: false });
      return true;
    } catch (error: any) {
      console.error('Update profile error:', error?.response?.data || error.message);
      set({ isLoading: false });
      return false;
    }
  },

  removeAvatar: async () => {
    set({ isLoading: true });
    try {
      const response = await api.delete('/api/auth/avatar');
      set({ user: response.data.user, isLoading: false });
      return true;
    } catch (error: any) {
      console.error('Remove avatar error:', error?.response?.data || error.message);
      set({ isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await removeItem('access_token');
    await removeItem('refresh_token');
    set({ user: null, token: null, isLoading: false, isInitialized: true });
  },
}));
