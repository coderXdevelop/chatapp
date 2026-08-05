import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PeerInfo } from '../../store/CallContext';
import { getRTCViewComponent } from '../../services/webrtcService';

interface VideoCallViewProps {
  peerInfo: PeerInfo | null;
  formattedDuration: string;
  localStream: any;
  remoteStream: any;
  isMuted: boolean;
  isVideoOff: boolean;
  isFrontCamera: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}

export const VideoCallView: React.FC<VideoCallViewProps> = ({
  peerInfo,
  formattedDuration,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isFrontCamera,
  onToggleMute,
  onToggleVideo,
  onSwitchCamera,
  onEndCall,
}) => {
  const RTCView = getRTCViewComponent();
  const remoteStreamUrl = (remoteStream as any)?.toURL ? (remoteStream as any).toURL() : null;
  const localStreamUrl = (localStream as any)?.toURL ? (localStream as any).toURL() : null;

  return (
    <View style={styles.container}>
      {/* Fullscreen Remote Stream */}
      <View style={styles.fullscreenMedia}>
        {RTCView && remoteStreamUrl ? (
          <RTCView streamURL={remoteStreamUrl} style={styles.fullVideo} objectFit="cover" />
        ) : (
          <View style={styles.remoteFallback}>
            {peerInfo?.avatarUrl ? (
              <Image source={{ uri: peerInfo.avatarUrl }} style={styles.fallbackAvatar} />
            ) : (
              <View style={styles.fallbackAvatarTextContainer}>
                <Text style={styles.fallbackAvatarText}>
                  {peerInfo?.displayName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.fallbackPeerName}>{peerInfo?.displayName || 'User'}</Text>
            <Text style={styles.connectingText}>Connecting video feed...</Text>
          </View>
        )}
      </View>

      {/* Floating Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerBadge}>
          <Text style={styles.peerHeaderName}>{peerInfo?.displayName || 'User'}</Text>
          <Text style={styles.timerText}>{formattedDuration || '00:00'}</Text>
        </View>
      </View>

      {/* Floating Local PIP Stream Window */}
      <View style={styles.pipWindow}>
        {RTCView && localStreamUrl && !isVideoOff ? (
          <RTCView
            streamURL={localStreamUrl}
            style={styles.pipVideo}
            objectFit="cover"
            mirror={isFrontCamera}
          />
        ) : (
          <View style={styles.pipPlaceholder}>
            <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={24} color="#F59E0B" />
            <Text style={styles.pipText}>{isVideoOff ? 'Cam Off' : 'You'}</Text>
          </View>
        )}
      </View>

      {/* Floating Bottom Control Bar */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onSwitchCamera}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-reverse" size={24} color="#F8FAFC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isVideoOff && styles.controlButtonOff]}
          onPress={onToggleVideo}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isVideoOff ? 'videocam-off' : 'videocam'}
            size={24}
            color={isVideoOff ? '#EF4444' : '#F8FAFC'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonOff]}
          onPress={onToggleMute}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isMuted ? '#EF4444' : '#F8FAFC'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.endCallButton} onPress={onEndCall} activeOpacity={0.8}>
          <Ionicons name="call-sharp" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenMedia: {
    ...StyleSheet.absoluteFill,
  },
  fullVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  remoteFallback: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#F59E0B',
    marginBottom: 16,
  },
  fallbackAvatarTextContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallbackAvatarText: {
    color: '#F59E0B',
    fontSize: 44,
    fontWeight: 'bold',
  },
  fallbackPeerName: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  connectingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  headerContainer: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  headerBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  peerHeaderName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
  },
  pipWindow: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 110,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#1E293B',
    elevation: 8,
    zIndex: 20,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    gap: 4,
  },
  pipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 36,
    elevation: 10,
    zIndex: 10,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonOff: {
    backgroundColor: '#451A1A',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  endCallButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
});
