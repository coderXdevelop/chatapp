import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/chatStore';

export interface SocketCallHandlers {
  onIncomingCall?: (data: { callId: string; callerId: string; callerName: string; callerAvatar?: string; isVideo: boolean; chatId?: string }) => void;
  onAcceptCall?: (data: { callId: string; recipientId: string; isVideo: boolean }) => void;
  onOffer?: (data: { callId: string; senderId: string; sdp: any; isVideo: boolean }) => void;
  onAnswer?: (data: { callId: string; senderId: string; sdp: any }) => void;
  onIceCandidate?: (data: { callId: string; senderId: string; candidate: any }) => void;
  onUserBusy?: (data: { callId: string; recipientId: string; isVideo: boolean }) => void;
  onRejectCall?: (data: { callId: string; recipientId: string; reason?: string }) => void;
  onCancelCall?: (data: { callId: string; callerId: string }) => void;
  onEndCall?: (data: { callId: string; endedBy: string; durationSeconds?: number }) => void;
  onCallTimeout?: (data: { callId: string; callerId: string }) => void;
  onReconnectCall?: (data: { callId: string; senderId: string; reason?: string }) => void;
}

export function useSocketEvents(handlers: SocketCallHandlers) {
  const socket = useChatStore((state) => state.socket);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: any) => handlersRef.current.onIncomingCall?.(data);
    const handleAcceptCall = (data: any) => handlersRef.current.onAcceptCall?.(data);
    const handleOffer = (data: any) => handlersRef.current.onOffer?.(data);
    const handleAnswer = (data: any) => handlersRef.current.onAnswer?.(data);
    const handleIceCandidate = (data: any) => handlersRef.current.onIceCandidate?.(data);
    const handleUserBusy = (data: any) => handlersRef.current.onUserBusy?.(data);
    const handleRejectCall = (data: any) => handlersRef.current.onRejectCall?.(data);
    const handleCancelCall = (data: any) => handlersRef.current.onCancelCall?.(data);
    const handleEndCall = (data: any) => handlersRef.current.onEndCall?.(data);
    const handleCallTimeout = (data: any) => handlersRef.current.onCallTimeout?.(data);
    const handleReconnectCall = (data: any) => handlersRef.current.onReconnectCall?.(data);

    socket.on('incoming-call', handleIncomingCall);
    socket.on('accept-call', handleAcceptCall);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
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
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-busy', handleUserBusy);
      socket.off('reject-call', handleRejectCall);
      socket.off('cancel-call', handleCancelCall);
      socket.off('end-call', handleEndCall);
      socket.off('call-timeout', handleCallTimeout);
      socket.off('reconnect-call', handleReconnectCall);
    };
  }, [socket]);
}
