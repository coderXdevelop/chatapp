import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createPeerConnection,
  getUserMediaStream,
  toggleAudioTrack,
  toggleVideoTrack,
  DEFAULT_ICE_SERVERS,
  getRTCSessionDescriptionClass,
  getRTCIceCandidateClass,
} from '../services/webrtcService';
import { useChatStore } from '../store/chatStore';

export interface UseWebRTCOptions {
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: (reason?: string) => void;
}

export function useWebRTC(options: UseWebRTCOptions = {}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const candidateQueueRef = useRef<any[]>([]);
  const socket = useChatStore((state) => state.socket);

  const cleanupWebRTC = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    candidateQueueRef.current = [];
    setIsMuted(false);
    setIsVideoOff(false);
  }, [localStream]);

  const initPeerConnection = useCallback(
    (targetUserId: string, callId: string) => {
      if (pcRef.current) return pcRef.current;

      const pc = createPeerConnection(DEFAULT_ICE_SERVERS);
      if (!pc) return null;

      pcRef.current = pc;

      // Handle ICE Candidates
      pc.onicecandidate = (event: any) => {
        if (event.candidate && socket) {
          socket.emit('ice_candidate', {
            callId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle Remote Stream Tracks
      pc.ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (options.onRemoteStream) {
            options.onRemoteStream(event.streams[0]);
          }
        }
      };

      return pc;
    },
    [socket, options]
  );

  // Start Call (Caller side)
  const initiateCall = useCallback(
    async (payload: {
      callId: string;
      recipientId: string;
      isVideo: boolean;
      callerInfo: { userId: string; displayName: string; avatarUrl?: string };
      chatId?: string;
    }) => {
      const { callId, recipientId, isVideo, callerInfo, chatId } = payload;
      const pc = initPeerConnection(recipientId, callId);
      if (!pc) return null;

      const stream = await getUserMediaStream(isVideo);
      if (stream) {
        setLocalStream(stream);
        stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit(
          'call_offer',
          {
            callId,
            recipientId,
            isVideo,
            sdp: offer,
            callerInfo,
            chatId,
          },
          (res: { success: boolean; error?: string }) => {
            if (!res?.success) {
              console.warn('[WebRTC] Offer failed:', res?.error);
              options.onCallEnded?.(res?.error || 'Call offer failed');
            }
          }
        );
      }

      return offer;
    },
    [initPeerConnection, socket, options]
  );

  // Answer Call (Recipient side)
  const answerCall = useCallback(
    async (payload: { callId: string; callerId: string; isVideo: boolean; offerSdp: any }) => {
      const { callId, callerId, isVideo, offerSdp } = payload;
      const pc = initPeerConnection(callerId, callId);
      if (!pc) return null;

      const stream = await getUserMediaStream(isVideo);
      if (stream) {
        setLocalStream(stream);
        stream.getTracks().forEach((track: any) => pc.addTrack(track, stream));
      }

      const SessionDesc = getRTCSessionDescriptionClass();
      const IceCandidate = getRTCIceCandidateClass();

      await pc.setRemoteDescription(SessionDesc ? new SessionDesc(offerSdp) : offerSdp);

      // Process queued candidates
      while (candidateQueueRef.current.length > 0) {
        const candidate = candidateQueueRef.current.shift();
        try {
          await pc.addIceCandidate(IceCandidate ? new IceCandidate(candidate) : candidate);
        } catch (e) {
          console.error('[WebRTC] Failed to add queued ICE candidate:', e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('call_answer', {
          callId,
          callerId,
          sdp: answer,
        });
      }

      return answer;
    },
    [initPeerConnection, socket]
  );

  // Handle incoming answer (Caller side)
  const handleAnswerReceived = useCallback(async (answerSdp: any) => {
    const pc = pcRef.current;
    if (!pc) return;

    const SessionDesc = getRTCSessionDescriptionClass();
    const IceCandidate = getRTCIceCandidateClass();

    await pc.setRemoteDescription(SessionDesc ? new SessionDesc(answerSdp) : answerSdp);

    // Process queued candidates
    while (candidateQueueRef.current.length > 0) {
      const candidate = candidateQueueRef.current.shift();
      try {
        await pc.addIceCandidate(IceCandidate ? new IceCandidate(candidate) : candidate);
      } catch (e) {
        console.error('[WebRTC] Failed to add queued ICE candidate:', e);
      }
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidateReceived = useCallback(async (candidate: any) => {
    const pc = pcRef.current;
    const IceCandidate = getRTCIceCandidateClass();
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(IceCandidate ? new IceCandidate(candidate) : candidate);
      } catch (e) {
        console.error('[WebRTC] Error adding ICE candidate:', e);
      }
    } else {
      candidateQueueRef.current.push(candidate);
    }
  }, []);

  // Toggle Mute Audio
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    toggleAudioTrack(localStream, !nextMuted);
  }, [isMuted, localStream]);

  // Toggle Video Off/On
  const toggleVideo = useCallback(() => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    toggleVideoTrack(localStream, !nextVideoOff);
  }, [isVideoOff, localStream]);

  // Switch Camera
  const switchCamera = useCallback(() => {
    setIsFrontCamera((prev) => !prev);
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack && (videoTrack as any)._switchCamera) {
        (videoTrack as any)._switchCamera();
      }
    }
  }, [localStream]);

  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, [cleanupWebRTC]);

  return {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isFrontCamera,
    initiateCall,
    answerCall,
    handleAnswerReceived,
    handleIceCandidateReceived,
    toggleMute,
    toggleVideo,
    switchCamera,
    cleanupWebRTC,
  };
}
