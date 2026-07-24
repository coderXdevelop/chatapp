import axios from 'axios';
import { getItem, setItem, removeItem } from './storage';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_URL ||
  'https://chatapp-4cpr.onrender.com';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh automatically on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and request hasn't been retried yet, and it's not the refresh/login/verify request
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/refresh') &&
      !originalRequest.url?.includes('/api/auth/login') &&
      !originalRequest.url?.includes('/api/auth/verify-otp')
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = await getItem('refresh_token');
        if (refreshToken) {
          // Use axios directly instead of api to avoid infinite loop
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });
          const { token: newToken, refreshToken: newRefreshToken } = response.data;
          
          if (newToken) {
            await setItem('access_token', newToken);
            if (newRefreshToken) {
              await setItem('refresh_token', newRefreshToken);
            }
            
            // Try to update Zustand auth store directly via dynamic require to avoid circular imports
            try {
              const { useAuthStore } = require('../store/authStore');
              if (useAuthStore) {
                useAuthStore.setState({ token: newToken });
              }
            } catch (storeError) {
              console.error('Failed to update authStore state:', storeError);
            }

            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Auto-refresh token failed, logging out user:', refreshError);
        await removeItem('access_token');
        await removeItem('refresh_token');
        try {
          const { useAuthStore } = require('../store/authStore');
          if (useAuthStore) {
            useAuthStore.setState({ user: null, token: null });
          }
        } catch (storeError) {
          // ignore
        }
      }
    }
    
    return Promise.reject(error);
  }
);

