export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Xirsys ICE Credential Service
 * Fetches dynamic, temporary TURN/STUN credentials from Xirsys REST API.
 * Never exposes identity or secret keys to the mobile client.
 */
export async function getXirsysIceServers(): Promise<RTCIceServer[]> {
  const ident = process.env.XIRSYS_IDENT;
  const secret = process.env.XIRSYS_SECRET;
  const channel = process.env.XIRSYS_CHANNEL || 'default';

  // Fallback public STUN servers if Xirsys is not configured
  const fallbackServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.xirsys.net' },
  ];

  if (!ident || !secret) {
    console.warn('[Xirsys] XIRSYS_IDENT or XIRSYS_SECRET not configured in .env. Falling back to public STUN servers.');
    return fallbackServers;
  }

  try {
    const authHeader = 'Basic ' + Buffer.from(`${ident}:${secret}`).toString('base64');
    const url = `https://global.xirsys.net/_turn/${channel}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'urls',
        expire: 86400, // 24 hours TTL for temporary session credentials
      }),
    });

    if (!response.ok) {
      console.error(`[Xirsys] API returned HTTP error ${response.status}: ${response.statusText}`);
      return fallbackServers;
    }

    const data: any = await response.json();

    if (data && data.s === 'ok' && data.v && data.v.iceServers) {
      console.log('[Xirsys] Successfully generated temporary ICE credentials from Xirsys API.');
      return data.v.iceServers;
    } else if (data && data.v && Array.isArray(data.v)) {
      return data.v;
    }

    console.warn('[Xirsys] Unexpected response format from Xirsys API. Returning fallback STUN servers.', data);
    return fallbackServers;
  } catch (error) {
    console.error('[Xirsys] Failed to fetch Xirsys ICE credentials:', error);
    return fallbackServers;
  }
}
