import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FullscreenVideoViewerProps {
  visible: boolean;
  videoUrl: string;
  title?: string;
  onClose: () => void;
  onDownload?: () => void;
}

export const FullscreenVideoViewer: React.FC<FullscreenVideoViewerProps> = ({
  visible,
  videoUrl,
  title = 'Video',
  onClose,
  onDownload,
}) => {
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (visible) {
      player.play();
      setIsPlaying(true);
      resetControlsTimer();
    } else {
      player.pause();
    }
  }, [visible, videoUrl]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  const handleToggleMute = () => {
    player.muted = !isMuted;
    setIsMuted(!isMuted);
    resetControlsTimer();
  };

  const handleSkip = (seconds: number) => {
    player.currentTime = Math.max(0, player.currentTime + seconds);
    resetControlsTimer();
  };

  const formatTime = (secs: number) => {
    const total = Math.floor(secs || 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setShowControls((prev) => !prev)}
        style={styles.container}
      >
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
        />

        {/* Overlay Controls */}
        {showControls && (
          <View style={styles.overlayContainer} pointerEvents="box-none">
            {/* Top Bar */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.title}>{title}</Text>

              {onDownload ? (
                <TouchableOpacity onPress={onDownload} style={styles.headerButton}>
                  <Ionicons name="download-outline" size={24} color={COLORS.accent} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 40 }} />
              )}
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <TouchableOpacity
                onPress={() => handleSkip(-10)}
                style={styles.controlCircle}
              >
                <Ionicons name="refresh-circle-outline" size={32} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleTogglePlay}
                style={[styles.controlCircle, styles.playCircle]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={36}
                  color={COLORS.primaryText}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSkip(10)}
                style={styles.controlCircle}
              >
                <Ionicons name="reload-circle-outline" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomBar}>
              <Text style={styles.timeText}>
                {formatTime(player.currentTime)} / {formatTime(player.duration)}
              </Text>

              <TouchableOpacity onPress={handleToggleMute} style={styles.muteButton}>
                <Ionicons
                  name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 30,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  controlCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
  },
  bottomBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  muteButton: {
    padding: 8,
  },
});
