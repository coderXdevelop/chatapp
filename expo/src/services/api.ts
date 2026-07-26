import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getItem, setItem, removeItem } from './storage';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_URL ||
  'https://chatapp-4cpr.onrender.com';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _retry?: boolean;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 25000, // 25s timeout to handle Render cold-start wakeups
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

// Response interceptor: Exponential Backoff Retries + Token Refresh Handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // 1. Check if error is 401 and handle token refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/refresh') &&
      !originalRequest.url?.includes('/api/auth/login') &&
      !originalRequest.url?.includes('/api/auth/verify-otp')
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = await getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });
          const { token: newToken, refreshToken: newRefreshToken } = response.data;

          if (newToken) {
            await setItem('access_token', newToken);
            if (newRefreshToken) {
              await setItem('refresh_token', newRefreshToken);
            }

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
      return Promise.reject(error);
    }

    // 2. Exponential Backoff Retry for network errors, timeouts, or 5xx server cold-start errors
    const isNetworkOr5xx =
      !error.response || (error.response.status >= 500 && error.response.status <= 599) || error.code === 'ECONNABORTED';

    const isIdempotentOrGet = originalRequest.method === 'get' || originalRequest.method === 'GET';

    if (isNetworkOr5xx && isIdempotentOrGet) {
      originalRequest._retryCount = originalRequest._retryCount || 0;

      if (originalRequest._retryCount < MAX_RETRIES) {
        originalRequest._retryCount += 1;

        // Exponential backoff: 1s, 2s, 4s delay + jitter (±200ms)
        const backoffDelay =
          INITIAL_RETRY_DELAY_MS * Math.pow(2, originalRequest._retryCount - 1) + Math.random() * 400 - 200;

        console.warn(
          `[API Network Retry] Retry ${originalRequest._retryCount}/${MAX_RETRIES} for ${originalRequest.url} in ${Math.round(backoffDelay)}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, Math.max(200, backoffDelay)));
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
