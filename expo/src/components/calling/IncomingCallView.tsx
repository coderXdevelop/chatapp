import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PeerInfo } from '../../store/CallContext';

interface IncomingCallViewProps {
  peerInfo: PeerInfo | null;
  isVideo: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallView: React.FC<IncomingCallViewProps> = ({
  peerInfo,
  isVideo,
  onAccept,
  onReject,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Ionicons name={isVideo ? 'videocam' : 'call'} size={28} color="#F59E0B" />
        <Text style={styles.incomingTitle}>Incoming {isVideo ? 'Video' : 'Voice'} Call</Text>
      </View>

      <View style={styles.callerSection}>
        {peerInfo?.avatarUrl ? (
          <Image source={{ uri: peerInfo.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {peerInfo?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.callerName}>{peerInfo?.displayName || 'Unknown Caller'}</Text>
        <Text style={styles.subtext}>LinkUP Real-Time Call</Text>
      </View>

      <View style={styles.actionButtonsRow}>
        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.declineButton} onPress={onReject} activeOpacity={0.8}>
            <Ionicons name="call-sharp" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>

        <View style={styles.actionItem}>
          <TouchableOpacity style={styles.acceptButton} onPress={onAccept} activeOpacity={0.8}>
            <Ionicons name="call-sharp" size={32} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
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
  headerSection: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  incomingTitle: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  callerSection: {
    alignItems: 'center',
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#F59E0B',
    marginBottom: 20,
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
    marginBottom: 20,
  },
  avatarInitial: {
    color: '#F59E0B',
    fontSize: 48,
    fontWeight: 'bold',
  },
  callerName: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtext: {
    color: '#64748B',
    fontSize: 14,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
  },
  declineButton: {
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
  acceptButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
});
