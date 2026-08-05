import { api } from './api';

export interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Fetch dynamic Xirsys ICE Servers from the backend.
 * Uses authenticated REST API so identity credentials are never stored in client code.
 */
export async function fetchXirsysIceServers(): Promise<RTCIceServerConfig[]> {
  try {
    const response = await api.get<{ success: boolean; iceServers: RTCIceServerConfig[] }>('/api/calls/ice-servers');
    if (response.data && response.data.success && Array.isArray(response.data.iceServers)) {
      return response.data.iceServers;
    }
  } catch (error) {
    console.warn('[CallAPI] Failed to fetch Xirsys ICE servers from backend. Falling back to public STUN:', error);
  }

  // Fallback public STUN servers
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];
}
