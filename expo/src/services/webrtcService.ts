// WebRTC Service Abstraction for Cross-Platform & Native Compatibility

export const DEFAULT_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export interface WebRTCConfiguration {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

export function getRTCPeerConnectionClass(): typeof RTCPeerConnection | null {
  if (typeof window !== 'undefined' && 'RTCPeerConnection' in window) {
    return window.RTCPeerConnection;
  }
  if (typeof globalThis !== 'undefined' && 'RTCPeerConnection' in globalThis) {
    return (globalThis as any).RTCPeerConnection;
  }
  return null;
}

export function createPeerConnection(config: WebRTCConfiguration = DEFAULT_ICE_SERVERS): RTCPeerConnection | null {
  const PeerConn = getRTCPeerConnectionClass();
  if (!PeerConn) {
    console.warn('[WebRTC] RTCPeerConnection is not available on this platform.');
    return null;
  }
  return new PeerConn(config as any);
}

// Enable Opus Discontinuous Transmission (DTX) & Forward Error Correction (FEC)
// DTX stops sending audio packets during silence, reducing per-user audio bandwidth by ~50%
export const enableOpusDtxAndFec = (sdp: string): string => {
  if (!sdp) return sdp;
  try {
    const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
    if (!opusMatch) return sdp;
    const payloadType = opusMatch[1];
    const fmtpRegex = new RegExp(`a=fmtp:${payloadType}\\s+(.*)`, 'i');
    if (fmtpRegex.test(sdp)) {
      return sdp.replace(fmtpRegex, (_match, params) => {
        let updated = params;
        if (!updated.includes('usedtx=1')) updated += ';usedtx=1';
        if (!updated.includes('useinbandfec=1')) updated += ';useinbandfec=1';
        return `a=fmtp:${payloadType} ${updated}`;
      });
    } else {
      const rtpmapLine = new RegExp(`(a=rtpmap:${payloadType}\\s+opus\\/48000\\/2.*)`, 'i');
      return sdp.replace(rtpmapLine, `$1\r\na=fmtp:${payloadType} usedtx=1;useinbandfec=1`);
    }
  } catch {
    return sdp;
  }
};

export interface MediaControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  facingMode: 'user' | 'environment';
}

export function toggleAudioTrack(stream: MediaStream | null, enabled: boolean): boolean {
  if (!stream) return false;
  stream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
  return enabled;
}

export function toggleVideoTrack(stream: MediaStream | null, enabled: boolean): boolean {
  if (!stream) return false;
  stream.getVideoTracks().forEach((track) => {
    track.enabled = enabled;
  });
  return enabled;
}

export async function getUserMediaStream(
  isVideo: boolean,
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo
          ? {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
            }
          : false,
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    }
  } catch (err) {
    console.warn('[WebRTC] getUserMedia failed or restricted:', err);
  }
  return null;
}
