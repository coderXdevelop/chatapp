import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchXirsysIceServers, RTCIceServerConfig } from '../services/callApi';
import {
  createPeerConnection,
  getRTCSessionDescriptionClass,
  getRTCIceCandidateClass,
  getMediaStreamClass,
} from '../services/webrtcService';

export type PeerConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface UseWebRTCOptions {
  onIceCandidate?: (candidate: any) => void;
  onConnectionStateChange?: (state: PeerConnectionState) => void;
}

export interface UseWebRTCReturn {
  peerConnectionState: PeerConnectionState;
  remoteStream: any;
  initPeerConnection: (localStream: any) => Promise<any>;
  createOffer: (options?: { isVideo?: boolean }) => Promise<any>;
  handleOfferAndCreateAnswer: (sdpOffer: any) => Promise<any>;
  handleAnswer: (sdpAnswer: any) => Promise<void>;
  addIceCandidate: (candidate: any) => Promise<void>;
  restartIce: () => Promise<void>;
  closePeerConnection: () => void;
}

export function useWebRTC(options?: UseWebRTCOptions): UseWebRTCReturn {
  const [peerConnectionState, setPeerConnectionState] = useState<PeerConnectionState>('new');
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const pcRef = useRef<any>(null);
  const pendingCandidatesRef = useRef<any[]>([]);
  const callbacksRef = useRef(options);

  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  /**
   * Close PeerConnection and dispose of all resources
   */
  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      console.log('[useWebRTC] Closing RTCPeerConnection and removing listeners');
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onaddstream = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch (e) {
        console.warn('[useWebRTC] Error closing peer connection:', e);
      }
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
    setRemoteStream(null);
    setPeerConnectionState('closed');
  }, []);

  /**
   * Initialize RTCPeerConnection with dynamic Xirsys ICE Servers
   */
  const initPeerConnection = useCallback(async (localStream: any): Promise<any> => {
    try {
      if (pcRef.current) {
        closePeerConnection();
      }

      // Fetch dynamic Xirsys ICE Server credentials from backend
      const iceServers: RTCIceServerConfig[] = await fetchXirsysIceServers();
      console.log(`[useWebRTC] Initializing RTCPeerConnection with ${iceServers.length} ICE servers.`);

      const pc = createPeerConnection({ iceServers });
      if (!pc) {
        throw new Error('Failed to instantiate RTCPeerConnection');
      }

      pcRef.current = pc;
      setPeerConnectionState('connecting');

      // Attach local stream tracks to PeerConnection
      if (localStream) {
        if (typeof pc.addTrack === 'function') {
          const tracks = localStream.getTracks ? localStream.getTracks() : [];
          tracks.forEach((track: any) => {
            pc.addTrack(track, localStream);
          });
        } else if (typeof pc.addStream === 'function') {
          pc.addStream(localStream);
        }
      }

      // Listen for remote track / stream events
      pc.ontrack = (event: any) => {
        console.log('[useWebRTC] Received remote track:', event?.track?.kind);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          setRemoteStream((prevStream: any) => {
            if (prevStream) return prevStream;
            const MediaStreamClass = getMediaStreamClass();
            if (MediaStreamClass) {
              const newStream = new MediaStreamClass();
              newStream.addTrack(event.track);
              return newStream;
            }
            return null;
          });
        }
      };


      pc.onaddstream = (event: any) => {
        console.log('[useWebRTC] Received remote stream via onaddstream:', event?.stream?.id);
        if (event.stream) {
          setRemoteStream(event.stream);
        }
      };

      // ICE candidate handler
      pc.onicecandidate = (event: any) => {
        if (event.candidate && callbacksRef.current?.onIceCandidate) {
          console.log('[useWebRTC] Generated local ICE candidate trickling');
          callbacksRef.current.onIceCandidate(event.candidate);
        }
      };

      // Monitor Connection State
      const updateState = () => {
        const state: PeerConnectionState = pc.connectionState || pc.iceConnectionState || 'new';
        console.log('[useWebRTC] Connection state changed:', state);
        setPeerConnectionState(state);
        if (callbacksRef.current?.onConnectionStateChange) {
          callbacksRef.current.onConnectionStateChange(state);
        }
      };

      pc.onconnectionstatechange = updateState;
      pc.oniceconnectionstatechange = updateState;

      return pc;
    } catch (error) {
      console.error('[useWebRTC] Failed to initialize PeerConnection:', error);
      setPeerConnectionState('failed');
      return null;
    }
  }, []);

  /**
   * Generate WebRTC SDP Offer
   */
  const createOffer = useCallback(async (options?: { isVideo?: boolean }): Promise<any> => {
    try {
      const pc = pcRef.current;
      if (!pc) throw new Error('PeerConnection is not initialized');

      const offerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: options?.isVideo ?? true,
      };

      const offer = await pc.createOffer(offerOptions);
      await pc.setLocalDescription(offer);
      console.log('[useWebRTC] Created and set local SDP offer successfully');
      return offer;
    } catch (error) {
      console.error('[useWebRTC] Error creating SDP offer:', error);
      throw error;
    }
  }, []);

  /**
   * Process incoming SDP Offer and generate SDP Answer
   */
  const handleOfferAndCreateAnswer = useCallback(async (sdpOffer: any): Promise<any> => {
    try {
      const pc = pcRef.current;
      if (!pc) throw new Error('PeerConnection is not initialized');

      const RTCSessionDescription = getRTCSessionDescriptionClass();
      const offerDescription = RTCSessionDescription
        ? new RTCSessionDescription(sdpOffer)
        : sdpOffer;

      await pc.setRemoteDescription(offerDescription);
      console.log('[useWebRTC] Set remote SDP offer description successfully');

      // Process any pending ICE candidates queued before remote description was set
      if (pendingCandidatesRef.current.length > 0) {
        console.log(`[useWebRTC] Draining ${pendingCandidatesRef.current.length} queued ICE candidates`);
        const RTCIceCandidate = getRTCIceCandidateClass();
        for (const cand of pendingCandidatesRef.current) {
          try {
            await pc.addIceCandidate(RTCIceCandidate ? new RTCIceCandidate(cand) : cand);
          } catch (e) {
            console.warn('[useWebRTC] Error adding queued ICE candidate:', e);
          }
        }
        pendingCandidatesRef.current = [];
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[useWebRTC] Created and set local SDP answer successfully');
      return answer;
    } catch (error) {
      console.error('[useWebRTC] Error handling offer and creating answer:', error);
      throw error;
    }
  }, []);

  /**
   * Process remote SDP Answer
   */
  const handleAnswer = useCallback(async (sdpAnswer: any): Promise<void> => {
    try {
      const pc = pcRef.current;
      if (!pc) throw new Error('PeerConnection is not initialized');

      const RTCSessionDescription = getRTCSessionDescriptionClass();
      const answerDescription = RTCSessionDescription
        ? new RTCSessionDescription(sdpAnswer)
        : sdpAnswer;

      await pc.setRemoteDescription(answerDescription);
      console.log('[useWebRTC] Set remote SDP answer description successfully');

      // Drain any queued ICE candidates
      if (pendingCandidatesRef.current.length > 0) {
        console.log(`[useWebRTC] Draining ${pendingCandidatesRef.current.length} queued ICE candidates`);
        const RTCIceCandidate = getRTCIceCandidateClass();
        for (const cand of pendingCandidatesRef.current) {
          try {
            await pc.addIceCandidate(RTCIceCandidate ? new RTCIceCandidate(cand) : cand);
          } catch (e) {
            console.warn('[useWebRTC] Error adding queued ICE candidate:', e);
          }
        }
        pendingCandidatesRef.current = [];
      }
    } catch (error) {
      console.error('[useWebRTC] Error handling remote SDP answer:', error);
    }
  }, []);

  /**
   * Add incoming ICE candidate trickling from peer
   */
  const addIceCandidate = useCallback(async (candidate: any): Promise<void> => {
    try {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        console.log('[useWebRTC] Queuing ICE candidate until remote description is set');
        pendingCandidatesRef.current.push(candidate);
        return;
      }

      const RTCIceCandidate = getRTCIceCandidateClass();
      const iceCand = RTCIceCandidate ? new RTCIceCandidate(candidate) : candidate;
      await pc.addIceCandidate(iceCand);
      console.log('[useWebRTC] Added remote ICE candidate successfully');
    } catch (error) {
      console.warn('[useWebRTC] Error adding ICE candidate:', error);
    }
  }, []);

  /**
   * Trigger ICE Restart renegotiation for network transitions (Wi-Fi ↔ Mobile Data)
   */
  const restartIce = useCallback(async (): Promise<void> => {
    try {
      const pc = pcRef.current;
      if (!pc) return;

      console.log('[useWebRTC] Triggering ICE restart renegotiation');
      if (typeof pc.restartIce === 'function') {
        pc.restartIce();
      } else {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
      }
    } catch (error) {
      console.error('[useWebRTC] Error during ICE restart:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      closePeerConnection();
    };
  }, [closePeerConnection]);

  return {
    peerConnectionState,
    remoteStream,
    initPeerConnection,
    createOffer,
    handleOfferAndCreateAnswer,
    handleAnswer,
    addIceCandidate,
    restartIce,
    closePeerConnection,
  };
}
