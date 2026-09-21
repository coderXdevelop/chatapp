import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createPeerConnection,
  getUserMediaStream,
  toggleAudioTrack,
  toggleVideoTrack,
  enableOpusDtxAndFec,
  DEFAULT_ICE_SERVERS,
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [connectionQuality, setConnectionQuality] = useState<'Good' | 'Fair' | 'Poor'>('Good');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const candidateQueueRef = useRef<any[]>([]);
  const isVideoRef = useRef<boolean>(false);
  const targetUserIdRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);

  const socket = useChatStore((state) => state.socket);

  const cleanupWebRTC = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    candidateQueueRef.current = [];
    setIsMuted(false);
    setIsVideoOff(false);
    setFacingMode('user');
    setConnectionQuality('Good');
    targetUserIdRef.current = null;
    callIdRef.current = null;
  }, []);

  const initPeerConnection = useCallback(
    (targetUserId: string, callId: string) => {
      if (pcRef.current) return pcRef.current;

      const pc = createPeerConnection(DEFAULT_ICE_SERVERS);
      if (!pc) return null;

      pcRef.current = pc;
      targetUserIdRef.current = targetUserId;
      callIdRef.current = callId;

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice_candidate', {
            callId,
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle Remote Stream Tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          if (options.onRemoteStream) {
            options.onRemoteStream(event.streams[0]);
          }
        }
      };

      // Connection quality & state monitoring
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          setConnectionQuality('Good');
        } else if (state === 'checking') {
          setConnectionQuality('Fair');
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionQuality('Poor');
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
      isVideoRef.current = isVideo;

      const pc = initPeerConnection(recipientId, callId);
      if (!pc) return null;

      const stream = await getUserMediaStream(isVideo, 'user');
      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });

      // Munge SDP for Opus DTX & FEC
      const optimizedSdp = enableOpusDtxAndFec(offer.sdp || '');
      const finalOffer = { type: offer.type, sdp: optimizedSdp };

      await pc.setLocalDescription(finalOffer as any);

      if (socket) {
        socket.emit(
          'call_offer',
          {
            callId,
            recipientId,
            isVideo,
            sdp: finalOffer,
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

      return finalOffer;
    },
    [initPeerConnection, socket, options]
  );

  // Answer Call (Recipient side)
  const answerCall = useCallback(
    async (payload: { callId: string; callerId: string; isVideo: boolean; offerSdp: any }) => {
      const { callId, callerId, isVideo, offerSdp } = payload;
      isVideoRef.current = isVideo;

      const pc = initPeerConnection(callerId, callId);
      if (!pc) return null;

      const stream = await getUserMediaStream(isVideo, 'user');
      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

      // Process queued candidates
      while (candidateQueueRef.current.length > 0) {
        const candidate = candidateQueueRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[WebRTC] Failed to add queued ICE candidate:', e);
        }
      }

      const answer = await pc.createAnswer();
      // Munge SDP for Opus DTX & FEC
      const optimizedSdp = enableOpusDtxAndFec(answer.sdp || '');
      const finalAnswer = { type: answer.type, sdp: optimizedSdp };

      await pc.setLocalDescription(finalAnswer as any);

      if (socket) {
        socket.emit('call_answer', {
          callId,
          callerId,
          sdp: finalAnswer,
        });
      }

      return finalAnswer;
    },
    [initPeerConnection, socket]
  );

  // Handle incoming answer (Caller side)
  const handleAnswerReceived = useCallback(async (answerSdp: any) => {
    const pc = pcRef.current;
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));

    // Process queued candidates
    while (candidateQueueRef.current.length > 0) {
      const candidate = candidateQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('[WebRTC] Failed to add queued ICE candidate:', e);
      }
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidateReceived = useCallback(async (candidate: any) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
    toggleAudioTrack(localStreamRef.current, !nextMuted);
  }, [isMuted]);

  // Toggle Video Off/On
  const toggleVideo = useCallback(() => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    toggleVideoTrack(localStreamRef.current, !nextVideoOff);
  }, [isVideoOff]);

  // Switch Camera (Front <-> Rear)
  const switchCamera = useCallback(async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);

    const pc = pcRef.current;
    const currentStream = localStreamRef.current;

    if (currentStream && pc) {
      try {
        // Stop current video tracks
        currentStream.getVideoTracks().forEach((t) => t.stop());

        // Get new media stream with switched facingMode
        const newStream = await getUserMediaStream(true, nextFacing);
        if (newStream) {
          const newVideoTrack = newStream.getVideoTracks()[0];
          if (newVideoTrack) {
            const senders = pc.getSenders ? pc.getSenders() : [];
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender && videoSender.replaceTrack) {
              await videoSender.replaceTrack(newVideoTrack);
            }
          }
          localStreamRef.current = newStream;
          setLocalStream(newStream);
        }
      } catch (err) {
        console.warn('[WebRTC] Error switching camera:', err);
      }
    }
  }, [facingMode]);

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
    facingMode,
    isFrontCamera: facingMode === 'user',
    connectionQuality,
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
