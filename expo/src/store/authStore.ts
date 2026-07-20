import { create } from 'zustand';
import { api } from '../services/api';
import { getItem, removeItem, setItem } from '../services/storage';

export interface UserProfile {
  id: string;
  phoneNumber: string;
  displayName: string;
  status: string;
  avatarUrl?: string;
  createdAt?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  loginWithFirebaseToken: (idToken: string, displayName?: string) => Promise<boolean>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { displayName?: string; status?: string; avatarUrl?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  loginWithFirebaseToken: async (idToken: string, displayName?: string) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/api/auth/firebase-login', {
        idToken,
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
      console.error('Login error:', error?.response?.data || error.message);
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

  logout: async () => {
    set({ isLoading: true });
    await removeItem('access_token');
    await removeItem('refresh_token');
    set({ user: null, token: null, isLoading: false, isInitialized: true });
  },
}));
