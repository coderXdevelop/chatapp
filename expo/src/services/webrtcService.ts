// WebRTC Service Abstraction for Cross-Platform & Native Compatibility
export const DEFAULT_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
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

export interface MediaControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isFrontCamera: boolean;
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

export async function getUserMediaStream(isVideo: boolean): Promise<MediaStream | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      return await navigator.mediaDevices.getUserMedia(constraints);
    }
  } catch (err) {
    console.warn('[WebRTC] getUserMedia failed or restricted:', err);
  }
  return null;
}
