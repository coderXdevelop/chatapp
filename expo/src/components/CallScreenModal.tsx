import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallContext } from '../store/CallContext';
import { getRTCViewComponent } from '../services/webrtcService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  const RTCView = getRTCViewComponent();
  const remoteStreamUrl = (remoteStream as any)?.toURL ? (remoteStream as any).toURL() : null;
  const localStreamUrl = (localStream as any)?.toURL ? (localStream as any).toURL() : null;

  if (callState === 'IDLE') {
    return null;
  }

  const isRinging = callState === 'RINGING' && !isCaller;
  const isConnected = callState === 'ACCEPTED';
  const isDialing = callState === 'DIALING' || (callState === 'RINGING' && isCaller);
  const isEnded = callState === 'ENDED' || callState === 'REJECTED';

  const getStatusText = () => {
    if (callState === 'DIALING') return 'Dialing...';
    if (callState === 'RINGING') return isCaller ? 'Ringing...' : 'Incoming Call...';
    if (callState === 'ACCEPTED') return formattedDuration;
    if (callState === 'REJECTED') return 'Call Declined';
    if (callState === 'ENDED') return 'Call Ended';
    return '';
  };

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* Background / Video view */}
        <View style={styles.mediaContainer}>

          {isVideo && isConnected && !isVideoOff ? (
            RTCView && remoteStreamUrl ? (
              <RTCView streamURL={remoteStreamUrl} style={styles.videoFullPlaceholder} objectFit="cover" />
            ) : (
              <View style={styles.videoFullPlaceholder}>
                <Text style={styles.videoStreamText}>Remote Video Connected</Text>
              </View>
            )
          ) : (
            <View style={styles.avatarWrapper}>
              <View style={[styles.avatarPulseRing, isDialing && styles.pulsingRing]}>
                {peerInfo?.avatarUrl ? (
                  <Image source={{ uri: peerInfo.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>
                      {peerInfo?.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* PIP Local Video Preview overlay if in video call */}
          {isVideo && isConnected && (
            <View style={styles.pipContainer}>
              {RTCView && localStreamUrl && !isVideoOff ? (
                <RTCView streamURL={localStreamUrl} style={styles.pipPlaceholder} objectFit="cover" mirror={isFrontCamera} />
              ) : (
                <View style={styles.pipPlaceholder}>
                  <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={18} color="#F59E0B" />
                  <Text style={styles.pipText}>{isVideoOff ? 'Off' : 'You'}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Top Header Overlay */}
        <View style={styles.topHeader}>
          <View style={styles.callTypeTag}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={14} color="#F59E0B" style={styles.callTypeIcon} />
            <Text style={styles.callTypeText}>{isVideo ? 'VIDEO CALL' : 'VOICE CALL'}</Text>
          </View>
          <Text style={styles.peerName}>{peerInfo?.displayName || 'Unknown User'}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* Bottom Action Controls */}
        <View style={styles.bottomControlsContainer}>
          {isRinging ? (
            <View style={styles.ringingButtonsRow}>
              {/* Decline Button */}
              <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => rejectCall('declined')}>
                <Ionicons name="call" size={28} color="#FFFFFF" style={styles.declineIcon} />
              </TouchableOpacity>

              {/* Accept Button */}
              <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={acceptCall}>
                <Ionicons name="call" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inCallToolbar}>
              {/* Mute Mic Button */}
              <TouchableOpacity
                style={[styles.toolBtn, isMuted && styles.toolBtnActive]}
                onPress={toggleMute}
                disabled={isEnded}
              >
                <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#0F172A' : '#F1F5F9'} />
              </TouchableOpacity>

              {/* Toggle Video Button */}
              {isVideo && (
                <TouchableOpacity
                  style={[styles.toolBtn, isVideoOff && styles.toolBtnActive]}
                  onPress={toggleVideo}
                  disabled={isEnded}
                >
                  <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={22} color={isVideoOff ? '#0F172A' : '#F1F5F9'} />
                </TouchableOpacity>
              )}

              {/* Switch Camera Button */}
              {isVideo && (
                <TouchableOpacity
                  style={styles.toolBtn}
                  onPress={switchCamera}
                  disabled={isEnded}
                >
                  <Ionicons name="camera-reverse-outline" size={22} color="#F1F5F9" />
                </TouchableOpacity>
              )}

              {/* Hang up End Call Button */}
              <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => endCall('user_hung_up')}>
                <Ionicons name="call" size={28} color="#FFFFFF" style={styles.declineIcon} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Deep slate dark mode
  },
  mediaContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFullPlaceholder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },

  videoStreamText: {
    color: '#94A3B8',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'DM Mono' : 'monospace',
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulseRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.4)', // Amber accent ring
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  pulsingRing: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  avatarImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  avatarFallback: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#F59E0B',
    fontSize: 52,
    fontWeight: 'bold',
  },
  pipContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    overflow: 'hidden',
    elevation: 6,
  },
  pipPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  pipText: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 4,
  },
  topHeader: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  callTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 8,
  },
  callTypeIcon: {
    marginRight: 6,
  },
  callTypeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  peerName: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'DM Mono' : 'monospace',
  },
  bottomControlsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  ringingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  inCallToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '90%',
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  acceptBtn: {
    backgroundColor: '#10B981', // Emerald green
  },
  declineBtn: {
    backgroundColor: '#EF4444', // Red hangup
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  toolBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: '#F59E0B', // Amber active state
  },
});
