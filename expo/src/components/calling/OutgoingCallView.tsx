import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PeerInfo } from '../../store/CallContext';

interface OutgoingCallViewProps {
  peerInfo: PeerInfo | null;
  isVideo: boolean;
  onEndCall: () => void;
}

export const OutgoingCallView: React.FC<OutgoingCallViewProps> = ({
  peerInfo,
  isVideo,
  onEndCall,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topInfo}>
        <Ionicons name={isVideo ? 'videocam' : 'call'} size={24} color="#F59E0B" />
        <Text style={styles.callingTypeHeader}>
          {isVideo ? 'LinkUP Video Call' : 'LinkUP Voice Call'}
        </Text>
      </View>

      <View style={styles.avatarSection}>
        <View style={styles.pulseContainer}>
          <View style={styles.pulseRing} />
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
        <Text style={styles.peerName}>{peerInfo?.displayName || 'User'}</Text>
        <Text style={styles.statusText}>Calling...</Text>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.endCallButton} onPress={onEndCall} activeOpacity={0.8}>
          <Ionicons name="call-sharp" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Slate 900
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  callingTypeHeader: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  avatarSection: {
    alignItems: 'center',
  },
  pulseContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#F59E0B',
    opacity: 0.4,
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#F59E0B',
  },
  avatarFallback: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#F59E0B',
    fontSize: 48,
    fontWeight: 'bold',
  },
  peerName: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '500',
  },
  controlsContainer: {
    marginBottom: 20,
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
