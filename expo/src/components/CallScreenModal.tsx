import React from 'react';
import { Modal, SafeAreaView, StyleSheet } from 'react-native';
import { useCallContext } from '../store/CallContext';
import { OutgoingCallView } from './calling/OutgoingCallView';
import { IncomingCallView } from './calling/IncomingCallView';
import { VoiceCallView } from './calling/VoiceCallView';
import { VideoCallView } from './calling/VideoCallView';

export const CallScreenModal: React.FC = () => {
  const {
    callState,
    isVideo,
    isCaller,
    peerInfo,
    formattedDuration,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isFrontCamera,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
  } = useCallContext();

  if (callState === 'IDLE') {
    return null;
  }

  const isRinging = callState === 'RINGING' && !isCaller;
  const isDialing = callState === 'DIALING' || (callState === 'RINGING' && isCaller);
  const isConnected = callState === 'ACCEPTED';

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Outgoing Dialing View */}
        {isDialing && (
          <OutgoingCallView
            peerInfo={peerInfo}
            isVideo={isVideo}
            onEndCall={() => endCall('cancelled')}
          />
        )}

        {/* Incoming Ringing View */}
        {isRinging && (
          <IncomingCallView
            peerInfo={peerInfo}
            isVideo={isVideo}
            onAccept={acceptCall}
            onReject={() => rejectCall('declined')}
          />
        )}

        {/* Active Connected Call View */}
        {isConnected && (
          isVideo ? (
            <VideoCallView
              peerInfo={peerInfo}
              formattedDuration={formattedDuration}
              localStream={localStream}
              remoteStream={remoteStream}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isFrontCamera={isFrontCamera}
              onToggleMute={toggleMute}
              onToggleVideo={toggleVideo}
              onSwitchCamera={switchCamera}
              onEndCall={() => endCall('ended')}
            />
          ) : (
            <VoiceCallView
              peerInfo={peerInfo}
              formattedDuration={formattedDuration}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              onEndCall={() => endCall('ended')}
            />
          )
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
