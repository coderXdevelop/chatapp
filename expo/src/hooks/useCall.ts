import { useCallback } from 'react';
import { useCallContext, CallState, PeerInfo } from '../store/CallContext';
import { useCallPermissions } from './useCallPermissions';

export interface UseCallReturn {
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
  startVoiceCall: (payload: { recipientId: string; displayName: string; avatarUrl?: string; chatId?: string }) => Promise<boolean>;
  startVideoCall: (payload: { recipientId: string; displayName: string; avatarUrl?: string; chatId?: string }) => Promise<boolean>;
  acceptCall: () => Promise<boolean>;
  rejectCall: (reason?: string) => void;
  endCall: (reason?: string) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
  hasCameraPermission: boolean;
  hasMicPermission: boolean;
  isCallFeatureEnabled: boolean;
}

export function useCall(): UseCallReturn {
  const callContext = useCallContext();
  const { requestPermissions, hasCameraPermission, hasMicPermission } = useCallPermissions();

  const startVoiceCall = useCallback(
    async (payload: { recipientId: string; displayName: string; avatarUrl?: string; chatId?: string }): Promise<boolean> => {
      const granted = await requestPermissions(false);
      if (!granted) {
        alert('Microphone permission is required to make a voice call.');
        return false;
      }
      await callContext.startCall({
        ...payload,
        isVideo: false,
      });
      return true;
    },
    [requestPermissions, callContext]
  );

  const startVideoCall = useCallback(
    async (payload: { recipientId: string; displayName: string; avatarUrl?: string; chatId?: string }): Promise<boolean> => {
      const granted = await requestPermissions(true);
      if (!granted) {
        alert('Camera and microphone permissions are required to make a video call.');
        return false;
      }
      await callContext.startCall({
        ...payload,
        isVideo: true,
      });
      return true;
    },
    [requestPermissions, callContext]
  );

  const acceptCall = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermissions(callContext.isVideo);
    if (!granted) {
      alert('Permissions are required to answer this call.');
      return false;
    }
    await callContext.acceptCall();
    return true;
  }, [requestPermissions, callContext]);

  return {
    callState: callContext.callState,
    callId: callContext.callId,
    isVideo: callContext.isVideo,
    isCaller: callContext.isCaller,
    peerInfo: callContext.peerInfo,
    callDurationSeconds: callContext.callDurationSeconds,
    formattedDuration: callContext.formattedDuration,
    localStream: callContext.localStream,
    remoteStream: callContext.remoteStream,
    isMuted: callContext.isMuted,
    isVideoOff: callContext.isVideoOff,
    isFrontCamera: callContext.isFrontCamera,
    startVoiceCall,
    startVideoCall,
    acceptCall,
    rejectCall: callContext.rejectCall,
    endCall: callContext.endCall,
    toggleMute: callContext.toggleMute,
    toggleVideo: callContext.toggleVideo,
    switchCamera: callContext.switchCamera,
    hasCameraPermission,
    hasMicPermission,
    isCallFeatureEnabled: callContext.isCallFeatureEnabled,
  };
}
