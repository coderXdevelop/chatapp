import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useChatStore } from './chatStore';
import { useAuthStore } from './authStore';
import { useWebRTC } from '../hooks/useWebRTC';

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
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
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
  const [incomingOfferSdp, setIncomingOfferSdp] = useState<any>(null);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);

  const timerRef = useRef<any>(null);
  const socket = useChatStore((state) => state.socket);
  const currentUser = useAuthStore((state) => state.user);

  // Feature Flag Check
  const isCallFeatureEnabled = process.env.EXPO_PUBLIC_FEATURE_CALLS_ENABLED !== 'false';

  const handleCallEndedEvent = useCallback((reason?: string) => {
    console.log('[CallContext] Call ended reason:', reason);
    setCallState('ENDED');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeout(() => {
      setCallState('IDLE');
      setCallId(null);
      setPeerInfo(null);
      setIncomingOfferSdp(null);
      setCallDurationSeconds(0);
    }, 1500);
  }, []);

  const webrtc = useWebRTC({
    onCallEnded: handleCallEndedEvent,
  });

  // Start Stopwatch Timer when call is accepted
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDurationSeconds(0);
    timerRef.current = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  // Format Duration string MM:SS or HH:MM:SS
  const formattedDuration = React.useMemo(() => {
    const mins = Math.floor(callDurationSeconds / 60);
    const secs = callDurationSeconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(mins)}:${pad(secs)}`;
  }, [callDurationSeconds]);

  // Initiate Outgoing Call
  const startCall = useCallback(
    async (payload: { recipientId: string; displayName: string; avatarUrl?: string; isVideo: boolean; chatId?: string }) => {
      if (!isCallFeatureEnabled) {
        alert('Voice and video calls are currently disabled.');
        return;
      }
      if (!currentUser) return;

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

      await webrtc.initiateCall({
        callId: newCallId,
        recipientId: payload.recipientId,
        isVideo: payload.isVideo,
        callerInfo: {
          userId: currentUser.id,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
        },
        chatId: payload.chatId,
      });
    },
    [isCallFeatureEnabled, currentUser, webrtc]
  );

  // Accept Incoming Call
  const acceptCall = useCallback(async () => {
    if (!callId || !peerInfo || !incomingOfferSdp) return;

    setCallState('ACCEPTED');
    startTimer();

    await webrtc.answerCall({
      callId,
      callerId: peerInfo.userId,
      isVideo,
      offerSdp: incomingOfferSdp,
    });
  }, [callId, peerInfo, incomingOfferSdp, isVideo, startTimer, webrtc]);

  // Reject Incoming Call
  const rejectCall = useCallback(
    (reason = 'declined') => {
      if (socket && callId && peerInfo) {
        socket.emit('call_reject', {
          callId,
          callerId: peerInfo.userId,
          isVideo,
          chatId,
          reason,
        });
      }
      setCallState('REJECTED');
      webrtc.cleanupWebRTC();
      setTimeout(() => {
        setCallState('IDLE');
        setCallId(null);
        setPeerInfo(null);
        setIncomingOfferSdp(null);
      }, 1000);
    },
    [socket, callId, peerInfo, isVideo, chatId, webrtc]
  );

  // End Active Call
  const endCall = useCallback(
    (reason = 'ended') => {
      if (socket && callId && peerInfo) {
        socket.emit('call_end', {
          callId,
          targetUserId: peerInfo.userId,
          reason,
        });

        // Save call log message if call was accepted and active
        if (callState === 'ACCEPTED') {
          socket.emit('save_call_log', {
            chatId,
            recipientId: peerInfo.userId,
            callId,
            isVideo,
            callStatus: 'accepted',
            durationSeconds: callDurationSeconds,
          });
        }
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallState('ENDED');
      webrtc.cleanupWebRTC();
      setTimeout(() => {
        setCallState('IDLE');
        setCallId(null);
        setPeerInfo(null);
        setIncomingOfferSdp(null);
        setCallDurationSeconds(0);
      }, 1200);
    },
    [socket, callId, peerInfo, callState, chatId, isVideo, callDurationSeconds, webrtc]
  );


  // Listen to Global Socket Call Events
  useEffect(() => {
    if (!socket) return;

    // Incoming Call Offer
    const handleIncomingOffer = (data: {
      callId: string;
      callerId: string;
      isVideo: boolean;
      sdp: any;
      callerInfo: { userId: string; displayName: string; avatarUrl?: string };
      chatId?: string;
    }) => {
      if (callState !== 'IDLE') {
        // Auto reject if already in a call
        socket.emit('call_reject', { callId: data.callId, callerId: data.callerId, reason: 'busy' });
        return;
      }

      setCallId(data.callId);
      setIsVideo(data.isVideo);
      setIsCaller(false);
      setPeerInfo({
        userId: data.callerInfo.userId,
        displayName: data.callerInfo.displayName,
        avatarUrl: data.callerInfo.avatarUrl,
      });
      setIncomingOfferSdp(data.sdp);
      setChatId(data.chatId);
      setCallState('RINGING');
    };

    // Call Answer Received (Caller side)
    const handleCallAnswer = (data: { callId: string; recipientId: string; sdp: any }) => {
      if (data.callId === callId) {
        setCallState('ACCEPTED');
        startTimer();
        webrtc.handleAnswerReceived(data.sdp);
      }
    };

    // ICE Candidate Received
    const handleIceCandidate = (data: { callId: string; senderUserId: string; candidate: any }) => {
      if (data.callId === callId) {
        webrtc.handleIceCandidateReceived(data.candidate);
      }
    };

    // Call Rejected Received
    const handleCallReject = (data: { callId: string; recipientId: string; reason?: string }) => {
      if (data.callId === callId) {
        setCallState('REJECTED');
        webrtc.cleanupWebRTC();
        setTimeout(() => {
          setCallState('IDLE');
          setCallId(null);
          setPeerInfo(null);
          setIncomingOfferSdp(null);
        }, 1200);
      }
    };

    // Call Ended Received
    const handleCallEnd = (data: { callId: string; endedBy: string; reason?: string }) => {
      if (data.callId === callId) {
        handleCallEndedEvent(data.reason);
      }
    };

    socket.on('call_offer', handleIncomingOffer);
    socket.on('call_answer', handleCallAnswer);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_reject', handleCallReject);
    socket.on('call_end', handleCallEnd);

    return () => {
      socket.off('call_offer', handleIncomingOffer);
      socket.off('call_answer', handleCallAnswer);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_reject', handleCallReject);
      socket.off('call_end', handleCallEnd);
    };
  }, [socket, callState, callId, startTimer, webrtc, handleCallEndedEvent]);

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
        localStream: webrtc.localStream,
        remoteStream: webrtc.remoteStream,
        isMuted: webrtc.isMuted,
        isVideoOff: webrtc.isVideoOff,
        isFrontCamera: webrtc.isFrontCamera,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute: webrtc.toggleMute,
        toggleVideo: webrtc.toggleVideo,
        switchCamera: webrtc.switchCamera,
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
