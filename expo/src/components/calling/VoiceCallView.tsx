import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PeerInfo } from '../../store/CallContext';

interface VoiceCallViewProps {
  peerInfo: PeerInfo | null;
  formattedDuration: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export const VoiceCallView: React.FC<VoiceCallViewProps> = ({
  peerInfo,
  formattedDuration,
  isMuted,
  onToggleMute,
  onEndCall,
}) => {
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LinkUP Voice Call</Text>
        <Text style={styles.timerText}>{formattedDuration || '00:00'}</Text>
      </View>

      <View style={styles.profileSection}>
        {peerInfo?.avatarUrl ? (
          <Image source={{ uri: peerInfo.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {peerInfo?.displayName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.peerName}>{peerInfo?.displayName || 'User'}</Text>
      </View>

      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
          onPress={toggleSpeaker}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
            size={26}
            color={isSpeakerOn ? '#0F172A' : '#F8FAFC'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonMuted]}
          onPress={onToggleMute}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={26}
            color={isMuted ? '#EF4444' : '#F8FAFC'}
          />
        </TouchableOpacity>

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
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
  },
  headerTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  profileSection: {
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
  peerName: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#1E293B',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 40,
    elevation: 6,
  },
  controlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#F59E0B',
  },
  controlButtonMuted: {
    backgroundColor: '#451A1A',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
});
