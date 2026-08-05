import { Platform } from 'react-native';

export const getIceServers = () => {
  const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
  const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const turnPassword = process.env.EXPO_PUBLIC_TURN_PASSWORD;

  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  if (turnUrl && turnUsername && turnPassword) {
    const cleanedUrl = turnUrl.replace(/^["']|["']$/g, '').trim();
    const cleanedUser = turnUsername.replace(/^["']|["']$/g, '').trim();
    const cleanedPass = turnPassword.replace(/^["']|["']$/g, '').trim();

    if (cleanedUrl && cleanedUser && cleanedPass) {
      const urls = cleanedUrl.includes(',')
        ? cleanedUrl.split(',').map((u) => u.trim()).filter(Boolean)
        : cleanedUrl;

      iceServers.push({
        urls,
        username: cleanedUser,
        credential: cleanedPass,
      });
    }
  }

  return { iceServers };
};

export const DEFAULT_ICE_SERVERS = getIceServers();

export interface WebRTCConfiguration {
  iceServers?: Array<{ urls: string | string[]; username?: string; credential?: string }>;
}

let mediaDevicesImpl: any = null;
let RTCPeerConnectionImpl: any = null;
let RTCViewImpl: any = null;
let RTCSessionDescriptionImpl: any = null;
let RTCIceCandidateImpl: any = null;
let MediaStreamImpl: any = null;

if (Platform.OS !== 'web') {
  try {
    const webrtc = require('react-native-webrtc');
    mediaDevicesImpl = webrtc.mediaDevices;
    RTCPeerConnectionImpl = webrtc.RTCPeerConnection;
    RTCViewImpl = webrtc.RTCView;
    RTCSessionDescriptionImpl = webrtc.RTCSessionDescription;
    RTCIceCandidateImpl = webrtc.RTCIceCandidate;
    MediaStreamImpl = webrtc.MediaStream;
    console.log('[WebRTC] Initialized react-native-webrtc native driver successfully.');
  } catch (err) {
    console.warn('[WebRTC] Could not load react-native-webrtc natively:', err);
  }
} else {
  if (typeof window !== 'undefined') {
    mediaDevicesImpl = navigator?.mediaDevices || null;
    RTCPeerConnectionImpl = (window as any).RTCPeerConnection || null;
    RTCSessionDescriptionImpl = (window as any).RTCSessionDescription || null;
    RTCIceCandidateImpl = (window as any).RTCIceCandidate || null;
    MediaStreamImpl = (window as any).MediaStream || null;
    console.log('[WebRTC] Initialized browser WebRTC driver successfully.');
  }
}

export function getRTCPeerConnectionClass(): any {
  return RTCPeerConnectionImpl;
}

export function getRTCSessionDescriptionClass(): any {
  return RTCSessionDescriptionImpl || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
}

export function getRTCIceCandidateClass(): any {
  return RTCIceCandidateImpl || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);
}

export function getMediaStreamClass(): any {
  return MediaStreamImpl || (typeof MediaStream !== 'undefined' ? MediaStream : null);
}

export function getRTCViewComponent(): any {
  return RTCViewImpl;
}


export function createPeerConnection(config?: WebRTCConfiguration): any {
  const finalConfig = config && config.iceServers && config.iceServers.length > 0 ? config : getIceServers();
  const PeerConn = getRTCPeerConnectionClass();
  if (!PeerConn) {
    console.warn('[WebRTC] RTCPeerConnection is not available on platform:', Platform.OS);
    return null;
  }
  console.log('[WebRTC] Creating RTCPeerConnection on platform:', Platform.OS, `with ${finalConfig.iceServers?.length || 0} ICE servers.`);
  return new PeerConn(finalConfig as any);
}

export interface MediaControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isFrontCamera: boolean;
}

export function toggleAudioTrack(stream: any, enabled: boolean): boolean {
  if (!stream) return false;
  const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
  tracks.forEach((track: any) => {
    track.enabled = enabled;
  });
  return enabled;
}

export function toggleVideoTrack(stream: any, enabled: boolean): boolean {
  if (!stream) return false;
  const tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
  tracks.forEach((track: any) => {
    track.enabled = enabled;
  });
  return enabled;
}

export async function getUserMediaStream(isVideo: boolean): Promise<any> {
  try {
    if (mediaDevicesImpl && mediaDevicesImpl.getUserMedia) {
      const constraints = {
        audio: true,
        video: isVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      console.log('[WebRTC] Requesting getUserMedia stream with constraints:', constraints);
      const stream = await mediaDevicesImpl.getUserMedia(constraints);
      console.log('[WebRTC] Obtained media stream successfully:', stream?.id);
      return stream;
    } else {
      console.warn('[WebRTC] mediaDevices.getUserMedia is not available on platform:', Platform.OS);
    }
  } catch (err) {
    console.warn('[WebRTC] getUserMedia failed or restricted:', err);
  }
  return null;
}
