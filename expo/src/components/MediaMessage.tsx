import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';

interface MediaMessageProps {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio';
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDuration?: number;
  isSending?: boolean;
  progress?: number;
  onCancel?: () => void;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  mediaUrl,
  mediaType,
  mediaWidth = 200,
  mediaHeight = 150,
  mediaDuration,
  isSending = false,
  progress = 0,
  onCancel,
}) => {
  const aspectRatio = (mediaWidth && mediaHeight) ? mediaWidth / mediaHeight : 4 / 3;
  const maxWidth = 260;
  const height = Math.min(maxWidth / aspectRatio, 320);

  const renderSendingOverlay = () => {
    if (!isSending) return null;
    return (
      <View style={[StyleSheet.absoluteFill, styles.progressOverlay]}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressText}>{progress ? `${progress}%` : '0%'}</Text>
          {onCancel && (
            <TouchableOpacity onPress={onCancel} style={styles.bubbleCancelButton}>
              <Ionicons name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (mediaType === 'image') {
    return (
      <View style={{ width: maxWidth, height, position: 'relative' }}>
        <Image
          source={{ uri: mediaUrl }}
          style={[styles.image, { width: maxWidth, height }]}
          contentFit="cover"
          transition={250}
          cachePolicy="disk"
        />
        {renderSendingOverlay()}
      </View>
    );
  }

  if (mediaType === 'video') {
    return (
      <View style={{ width: maxWidth, height, position: 'relative' }}>
        <VideoMessageItem url={mediaUrl} width={maxWidth} height={height} />
        {renderSendingOverlay()}
      </View>
    );
  }

  if (mediaType === 'audio') {
    return (
      <View style={{ position: 'relative', width: 240 }}>
        <VoiceMessageItem url={mediaUrl} duration={mediaDuration} />
        {renderSendingOverlay()}
      </View>
    );
  }

  return null;
};

const VideoMessageItem: React.FC<{ url: string; width: number; height: number }> = ({ url, width, height }) => {
  const player = useVideoPlayer(url, (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.muted = false;
  });

  return (
    <View style={[styles.videoContainer, { width, height }]}>
      <VideoView
        style={styles.videoView}
        player={player}
        {...({
          allowsFullscreen: true,
          nativeControls: true,
        } as any)}
      />
    </View>
  );
};

const VoiceMessageItem: React.FC<{ url: string; duration?: number }> = ({ url, duration }) => {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const togglePlayback = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  const displayTime = formatTime(status.currentTime || 0);
  const totalTime = formatTime(status.duration || duration || 0);

  return (
    <View style={styles.voiceContainer}>
      <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={22}
          color="#FFD700"
        />
      </TouchableOpacity>
      
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{displayTime}</Text>
          <Text style={styles.timeText}>{totalTime}</Text>
        </View>
      </View>
    </View>
  );
};

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const styles = StyleSheet.create({
  image: {
    borderRadius: 12,
    backgroundColor: '#101622',
  },
  videoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#070b13',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#101622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f293d',
    width: 240,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1f293d',
    borderRadius: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#64748B',
  },
  progressOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  progressCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
    position: 'relative',
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bubbleCancelButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
