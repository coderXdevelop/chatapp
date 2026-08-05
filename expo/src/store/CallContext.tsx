import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChatStore } from './chatStore';
import { useAuthStore } from './authStore';
import { useWebRTC } from '../hooks/useWebRTC';
import { useMediaStream } from '../hooks/useMediaStream';

export type CallState = 'IDLE' | 'DIALING' | 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'ENDED';

export interface PeerInfo {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface CallContextType {
  callState: CallState;
  callId: string | null;
  isVideo: boolean;
  isCaller: boolean;
  peerInfo: PeerInfo | null;
  callDurationSeconds: number;
  formattedDuration: string;
  localStream: any;
  remoteStream: any;
  isMuted: boolean;
  isVideoOff: boolean;
  isFrontCamera: boolean;
  startCall: (payload: { recipientId: string; displayName: string; avatarUrl?: string; isVideo: boolean; chatId?: string }) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: (reason?: string) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
  isCallFeatureEnabled: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [callId, setCallId] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [isCaller, setIsCaller] = useState<boolean>(false);
  const [peerInfo, setPeerInfo] = useState<PeerInfo | null>(null);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);

  const timerRef = useRef<any>(null);
  const ringTimeoutRef = useRef<any>(null);

  const socket = useChatStore((state) => state.socket);
  const currentUser = useAuthStore((state) => state.user);

  // Feature Flag Check
  const isCallFeatureEnabled = process.env.EXPO_PUBLIC_FEATURE_CALLS_ENABLED !== 'false';

  // Hardware Media Stream Hook
  const {
    localStream,
    isAudioMuted,
    isVideoOff,
    isFrontCamera,
    acquireLocalStream,
    toggleMuteAudio,
    toggleVideo,
    switchCamera,
    stopLocalStream,
  } = useMediaStream();

  // Socket Ice Candidate Relaying callback for useWebRTC
  const handleLocalIceCandidate = useCallback(
    (candidate: any) => {
      if (socket && callId && peerInfo) {
        socket.emit('ice-candidate', {
          callId,
          targetUserId: peerInfo.userId,
          candidate,
        });
      }
    },
    [socket, callId, peerInfo]
  );

  // WebRTC PeerConnection Hook
  const {
    remoteStream,
    initPeerConnection,
    createOffer,
    handleOfferAndCreateAnswer,
    handleAnswer,
    addIceCandidate,
    restartIce,
    closePeerConnection,
  } = useWebRTC({
    onIceCandidate: handleLocalIceCandidate,
  });

  /**
   * Reset active call state and release hardware resources
   */
  const cleanupCallState = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    closePeerConnection();
    stopLocalStream();

    setTimeout(() => {
      setCallState('IDLE');
      setCallId(null);
      setPeerInfo(null);
      setChatId(undefined);
      setCallDurationSeconds(0);
    }, 1200);
  }, [closePeerConnection, stopLocalStream]);

  // Stopwatch timer for call duration
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDurationSeconds(0);
    timerRef.current = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const formattedDuration = useMemo(() => {
    const mins = Math.floor(callDurationSeconds / 60);
    const secs = callDurationSeconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(mins)}:${pad(secs)}`;
  }, [callDurationSeconds]);

  /**
   * Initiate Outgoing Call (Caller)
   */
  const startCall = useCallback(
    async (payload: { recipientId: string; displayName: string; avatarUrl?: string; isVideo: boolean; chatId?: string }) => {
      if (!isCallFeatureEnabled) {
        alert('Voice and video calls are currently disabled.');
        return;
      }
      if (!currentUser || !socket) return;

      const newCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setCallId(newCallId);
      setIsVideo(payload.isVideo);
      setIsCaller(true);
      setPeerInfo({
        userId: payload.recipientId,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl,
      });
      setChatId(payload.chatId);
      setCallState('DIALING');

      // Acquire mic/camera stream
      const stream = await acquireLocalStream(payload.isVideo);
      await initPeerConnection(stream);

      // Emit call-user event to signaling server
      socket.emit('call-user', {
        callId: newCallId,
        recipientId: payload.recipientId,
        isVideo: payload.isVideo,
        chatId: payload.chatId,
      });

      // 30 seconds ring timeout if recipient does not answer
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        if (socket && newCallId) {
          socket.emit('call-timeout', {
            callId: newCallId,
            recipientId: payload.recipientId,
            isVideo: payload.isVideo,
            chatId: payload.chatId,
          });
        }
        setCallState('ENDED');
        cleanupCallState();
      }, 30000);
    },
    [isCallFeatureEnabled, currentUser, socket, acquireLocalStream, initPeerConnection, cleanupCallState]
  );

  /**
   * Accept Incoming Call (Recipient)
   */
  const acceptCall = useCallback(async () => {
    if (!callId || !peerInfo || !socket) return;

    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }

    setCallState('ACCEPTED');
    startTimer();

    // Acquire local media stream and initialize peer connection
    const stream = await acquireLocalStream(isVideo);
    await initPeerConnection(stream);

    // Notify caller that call was accepted
    socket.emit('accept-call', {
      callId,
      callerId: peerInfo.userId,
      isVideo,
    });
  }, [callId, peerInfo, socket, isVideo, startTimer, acquireLocalStream, initPeerConnection]);

  /**
   * Reject Incoming Call (Recipient)
   */
  const rejectCall = useCallback(
    (reason = 'declined') => {
      if (socket && callId && peerInfo) {
        socket.emit('reject-call', {
          callId,
          callerId: peerInfo.userId,
          isVideo,
          chatId,
          reason,
        });
      }
      setCallState('REJECTED');
      cleanupCallState();
    },
    [socket, callId, peerInfo, isVideo, chatId, cleanupCallState]
  );

  /**
   * End Active Call (Either Party)
   */
  const endCall = useCallback(
    (reason = 'ended') => {
      if (socket && callId && peerInfo) {
        if (callState === 'DIALING' || callState === 'RINGING') {
          if (isCaller) {
            socket.emit('cancel-call', {
              callId,
              recipientId: peerInfo.userId,
              isVideo,
              chatId,
            });
          } else {
            socket.emit('reject-call', {
              callId,
              callerId: peerInfo.userId,
              isVideo,
              chatId,
              reason: 'declined',
            });
          }
        } else {
          socket.emit('end-call', {
            callId,
            targetUserId: peerInfo.userId,
            isVideo,
            chatId,
            durationSeconds: callDurationSeconds,
          });
        }
      }
      setCallState('ENDED');
      cleanupCallState();
    },
    [socket, callId, peerInfo, isVideo, chatId, callState, isCaller, callDurationSeconds, cleanupCallState]
  );

  /**
   * Register Global Signaling Socket Listeners
   */
  useEffect(() => {
    if (!socket) return;

    // Incoming Call (Recipient)
    const handleIncomingCall = (data: {
      callId: string;
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      isVideo: boolean;
      chatId?: string;
    }) => {
      if (callState !== 'IDLE') {
        socket.emit('reject-call', {
          callId: data.callId,
          callerId: data.callerId,
          isVideo: data.isVideo,
          chatId: data.chatId,
          reason: 'busy',
        });
        return;
      }

      setCallId(data.callId);
      setIsVideo(data.isVideo);
      setIsCaller(false);
      setPeerInfo({
        userId: data.callerId,
        displayName: data.callerName,
        avatarUrl: data.callerAvatar,
      });
      setChatId(data.chatId);
      setCallState('RINGING');
    };

    // Caller receives accept-call -> sends SDP Offer
    const handleAcceptCall = async (data: { callId: string; recipientId: string; isVideo: boolean }) => {
      if (data.callId === callId && peerInfo) {
        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }

        setCallState('ACCEPTED');
        startTimer();

        try {
          const offer = await createOffer({ isVideo: data.isVideo });
          socket.emit('offer', {
            callId: data.callId,
            targetUserId: peerInfo.userId,
            sdp: offer,
            isVideo: data.isVideo,
          });
        } catch (e) {
          console.error('[CallContext] Failed to create and send offer:', e);
        }
      }
    };

    // Recipient receives SDP Offer -> sends SDP Answer
    const handleOffer = async (data: { callId: string; senderId: string; sdp: any; isVideo: boolean }) => {
      if (data.callId === callId) {
        try {
          const answer = await handleOfferAndCreateAnswer(data.sdp);
          socket.emit('answer', {
            callId: data.callId,
            targetUserId: data.senderId,
            sdp: answer,
          });
        } catch (e) {
          console.error('[CallContext] Failed to process offer and create answer:', e);
        }
      }
    };

    // Caller receives SDP Answer
    const handleAnswerEvent = async (data: { callId: string; senderId: string; sdp: any }) => {
      if (data.callId === callId) {
        await handleAnswer(data.sdp);
      }
    };

    // Receive ICE Candidate trickling
    const handleIceCandidateEvent = async (data: { callId: string; senderId: string; candidate: any }) => {
      if (data.callId === callId) {
        await addIceCandidate(data.candidate);
      }
    };

    // Handle user-busy signal
    const handleUserBusy = (data: { callId: string }) => {
      if (data.callId === callId) {
        setCallState('REJECTED');
        alert('User is currently busy on another call.');
        cleanupCallState();
      }
    };

    // Handle reject-call, cancel-call, end-call, call-timeout
    const handleRejectCall = (data: { callId: string }) => {
      if (data.callId === callId) {
        setCallState('REJECTED');
        cleanupCallState();
      }
    };

    const handleCancelCall = (data: { callId: string }) => {
      if (data.callId === callId) {
        setCallState('ENDED');
        cleanupCallState();
      }
    };

    const handleEndCall = (data: { callId: string }) => {
      if (data.callId === callId) {
        setCallState('ENDED');
        cleanupCallState();
      }
    };

    const handleCallTimeout = (data: { callId: string }) => {
      if (data.callId === callId) {
        setCallState('ENDED');
        cleanupCallState();
      }
    };

    const handleReconnectCall = (data: { callId: string }) => {
      if (data.callId === callId) {
        restartIce();
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('accept-call', handleAcceptCall);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswerEvent);
    socket.on('ice-candidate', handleIceCandidateEvent);
    socket.on('user-busy', handleUserBusy);
    socket.on('reject-call', handleRejectCall);
    socket.on('cancel-call', handleCancelCall);
    socket.on('end-call', handleEndCall);
    socket.on('call-timeout', handleCallTimeout);
    socket.on('reconnect-call', handleReconnectCall);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('accept-call', handleAcceptCall);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswerEvent);
      socket.off('ice-candidate', handleIceCandidateEvent);
      socket.off('user-busy', handleUserBusy);
      socket.off('reject-call', handleRejectCall);
      socket.off('cancel-call', handleCancelCall);
      socket.off('end-call', handleEndCall);
      socket.off('call-timeout', handleCallTimeout);
      socket.off('reconnect-call', handleReconnectCall);
    };
  }, [
    socket,
    callState,
    callId,
    peerInfo,
    startTimer,
    createOffer,
    handleOfferAndCreateAnswer,
    handleAnswer,
    addIceCandidate,
    restartIce,
    cleanupCallState,
  ]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callId,
        isVideo,
        isCaller,
        peerInfo,
        callDurationSeconds,
        formattedDuration,
        localStream,
        remoteStream,
        isMuted: isAudioMuted,
        isVideoOff,
        isFrontCamera,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute: toggleMuteAudio,
        toggleVideo,
        switchCamera,
        isCallFeatureEnabled,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCallContext = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
};
