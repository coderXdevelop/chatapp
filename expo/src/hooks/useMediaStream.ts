import { useState, useCallback, useRef, useEffect } from 'react';
import { getUserMediaStream, toggleAudioTrack, toggleVideoTrack } from '../services/webrtcService';

export interface UseMediaStreamReturn {
  localStream: any;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isFrontCamera: boolean;
  acquireLocalStream: (isVideo: boolean) => Promise<any>;
  toggleMuteAudio: () => boolean;
  toggleVideo: () => boolean;
  switchCamera: () => void;
  stopLocalStream: () => void;
}

export function useMediaStream(): UseMediaStreamReturn {
  const [localStream, setLocalStream] = useState<any>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);
  const localStreamRef = useRef<any>(null);

  /**
   * Stop all tracks and release hardware resources
   */
  const stopLocalStream = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      console.log('[useMediaStream] Stopping local stream tracks and releasing hardware');
      if (typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track: any) => {
          try {
            track.stop();
          } catch (e) {
            console.warn('[useMediaStream] Error stopping track:', e);
          }
        });
      } else if (typeof stream.release === 'function') {
        stream.release();
      }
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);

  /**
   * Acquire local audio/video media stream based on call type
   */
  const acquireLocalStream = useCallback(async (isVideo: boolean): Promise<any> => {
    try {
      if (localStreamRef.current) {
        stopLocalStream();
      }

      console.log(`[useMediaStream] Acquiring local media stream (Video: ${isVideo})`);
      const stream = await getUserMediaStream(isVideo);

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsAudioMuted(false);
        setIsVideoOff(!isVideo);
        setIsFrontCamera(true);
        return stream;
      }
    } catch (error) {
      console.error('[useMediaStream] Error acquiring local media stream:', error);
    }
    return null;
  }, []);

  /**
   * Mute or unmute local microphone track
   */
  const toggleMuteAudio = useCallback((): boolean => {
    const stream = localStreamRef.current;
    if (!stream) return false;

    const newMutedState = !isAudioMuted;
    toggleAudioTrack(stream, !newMutedState);
    setIsAudioMuted(newMutedState);
    console.log(`[useMediaStream] Audio muted: ${newMutedState}`);
    return newMutedState;
  }, [isAudioMuted]);

  /**
   * Enable or disable local camera video track
   */
  const toggleVideo = useCallback((): boolean => {
    const stream = localStreamRef.current;
    if (!stream) return false;

    const newVideoOffState = !isVideoOff;
    toggleVideoTrack(stream, !newVideoOffState);
    setIsVideoOff(newVideoOffState);
    console.log(`[useMediaStream] Video off: ${newVideoOffState}`);
    return newVideoOffState;
  }, [isVideoOff]);

  /**
   * Switch between front and back camera facing modes
   */
  const switchCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
    if (videoTracks.length === 0) return;

    const videoTrack = videoTracks[0];

    // Method provided by react-native-webrtc for native camera switching
    if (typeof videoTrack._switchCamera === 'function') {
      videoTrack._switchCamera();
      setIsFrontCamera((prev) => !prev);
      console.log('[useMediaStream] Native camera switched');
    } else {
      console.warn('[useMediaStream] _switchCamera is not available on current track.');
    }
  }, []);

  useEffect(() => {
    return () => {
      stopLocalStream();
    };
  }, [stopLocalStream]);

  return {
    localStream,
    isAudioMuted,
    isVideoOff,
    isFrontCamera,
    acquireLocalStream,
    toggleMuteAudio,
    toggleVideo,
    switchCamera,
    stopLocalStream,
  };
}
