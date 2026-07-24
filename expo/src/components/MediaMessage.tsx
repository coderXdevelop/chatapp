import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

interface MediaMessageProps {
  messageId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mediaWidth?: number;
  mediaHeight?: number;
  mediaDuration?: number;
  mediaSize?: number;
  text?: string;
  isSending?: boolean;
  progress?: number;
  onCancel?: () => void;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  messageId,
  mediaUrl,
  mediaType,
  mediaWidth = 200,
  mediaHeight = 150,
  mediaDuration,
  mediaSize,
  text,
  isSending = false,
  progress = 0,
  onCancel,
}) => {
  const aspectRatio = (mediaWidth && mediaHeight) ? mediaWidth / mediaHeight : 4 / 3;
  const maxWidth = 260;
  const height = Math.min(maxWidth / aspectRatio, 320);

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const fileExtension = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'm4a' : 'jpg';
  const localCachePath = `${FileSystem.documentDirectory}media_${messageId}.${fileExtension}`;

  useEffect(() => {
    const checkCache = async () => {
      if (mediaUrl.startsWith('file://') || mediaUrl.startsWith('ph://')) {
        setIsDownloaded(true);
        setLocalUri(mediaUrl);
        return;
      }

      try {
        const info = await FileSystem.getInfoAsync(localCachePath);
        if (info.exists) {
          setIsDownloaded(true);
          setLocalUri(localCachePath);
        } else {
          setIsDownloaded(false);
          setLocalUri(null);
        }
      } catch (e) {
        console.error('Cache check failed:', e);
      }
    };

    checkCache();
  }, [mediaUrl, messageId]);

  const startDownload = async () => {
    try {
      setIsDownloading(true);
      const downloadResult = await FileSystem.downloadAsync(mediaUrl, localCachePath);
      setLocalUri(downloadResult.uri);
      setIsDownloaded(true);
    } catch (err) {
      console.error('Download failed:', err);
      Alert.alert('Error', 'Failed to download media file.');
    } finally {
      setIsDownloading(false);
    }
  };

  const getBlurredUrl = (url: string): string => {
    if (url.startsWith('http') && url.includes('cloudinary.com')) {
      return url.replace('/upload/', '/upload/e_blur:1000,w_100,q_auto/');
    }
    return url;
  };

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

  const renderDownloadOverlay = () => {
    if (isSending || isDownloaded || mediaType === 'document') return null;
    return (
      <View style={[StyleSheet.absoluteFill, styles.downloadOverlay]}>
        {isDownloading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <TouchableOpacity onPress={startDownload} style={styles.downloadCircle}>
            <Ionicons name="arrow-down" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderContent = () => {
    const activeUrl = isDownloaded && localUri ? localUri : getBlurredUrl(mediaUrl);

    if (mediaType === 'image') {
      return (
        <Image
          source={{ uri: activeUrl }}
          style={[styles.image, { width: maxWidth, height }]}
          contentFit="cover"
          transition={250}
          cachePolicy="disk"
        />
      );
    }

    if (mediaType === 'video') {
      return <VideoMessageItem url={activeUrl} width={maxWidth} height={height} isLocked={!isDownloaded} />;
    }

    if (mediaType === 'audio') {
      return (
        <VoiceMessageItem
          messageId={messageId}
          url={activeUrl}
          duration={mediaDuration}
          isLocked={!isDownloaded}
          onPlayPress={startDownload}
        />
      );
    }

    if (mediaType === 'document') {
      const docName = text || 'Document';
      const docSize = formatFileSize(mediaSize);
      const isPdf = docName.toLowerCase().endsWith('.pdf');
      const iconName = isPdf ? 'document-text' : 'document';
      const iconColor = isPdf ? '#EF4444' : '#F59E0B';

      const handlePress = async () => {
        if (!isDownloaded) {
          await startDownload();
        } else if (localUri) {
          try {
            const Sharing = require('expo-sharing');
            if (Sharing && await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(localUri);
            } else {
              Alert.alert('File Location', `Saved locally at:\n${localUri}`);
            }
          } catch (e) {
            console.error('Sharing failed:', e);
            Alert.alert('File Location', `Saved locally at:\n${localUri}`);
          }
        }
      };

      return (
        <TouchableOpacity onPress={handlePress} style={styles.documentCard}>
          <View style={styles.documentIconContainer}>
            <Ionicons name={iconName} size={26} color={iconColor} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentName} numberOfLines={1}>
              {docName}
            </Text>
            <Text style={styles.documentMetadata}>
              {isDownloaded ? docSize : `${docSize} • Tap to download`}
            </Text>
          </View>
          {!isDownloaded && (
            <View style={styles.documentDownloadIcon}>
              {isDownloading ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <Ionicons name="arrow-down-circle" size={22} color="#64748B" />
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return null;
  };

  return (
    <View style={{ width: (mediaType === 'audio' || mediaType === 'document') ? 240 : maxWidth, height: (mediaType === 'audio' || mediaType === 'document') ? 'auto' : height, position: 'relative' }}>
      {renderContent()}
      {renderSendingOverlay()}
      {renderDownloadOverlay()}
    </View>
  );
};

const VideoMessageItem: React.FC<{ url: string; width: number; height: number; isLocked: boolean }> = ({ url, width, height, isLocked }) => {
  const player = useVideoPlayer(url, (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.muted = false;
  });

  if (isLocked) {
    return (
      <View style={[styles.videoContainer, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="videocam" size={40} color="rgba(255,255,255,0.4)" />
      </View>
    );
  }

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

const VoiceMessageItem: React.FC<{
  messageId: string;
  url: string;
  duration?: number;
  isLocked: boolean;
  onPlayPress: () => void;
}> = ({ messageId, url, duration, isLocked, onPlayPress }) => {
  const peaks = React.useMemo(() => {
    const seed = messageId || 'defaultMsg';
    const list = [];
    for (let i = 0; i < 28; i++) {
      const code = seed.charCodeAt(i % seed.length) || 30;
      const h = 4 + (code % 16);
      list.push(h);
    }
    return list;
  }, [messageId]);

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

  if (isLocked) {
    const totalTimeLocked = formatTime(duration || 0);
    return (
      <View style={styles.voiceContainer}>
        <TouchableOpacity onPress={onPlayPress} style={styles.playButton}>
          <Ionicons
            name="arrow-down"
            size={20}
            color="#FFD700"
          />
        </TouchableOpacity>
        
        <View style={styles.progressBarWrapper}>
          <View style={styles.waveformContainer}>
            {peaks.map((h, i) => (
              <View key={i} style={[styles.waveformBar, { height: h, backgroundColor: '#1f293d' }]} />
            ))}
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>0:00</Text>
            <Text style={styles.timeText}>{totalTimeLocked} (Download)</Text>
          </View>
        </View>
      </View>
    );
  }

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
        <View style={styles.waveformContainer}>
          {peaks.map((h, i) => {
            const isActive = progress >= (i / peaks.length);
            return (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: h,
                    backgroundColor: isActive ? '#F59E0B' : '#1f293d',
                  },
                ]}
              />
            );
          })}
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

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  downloadOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  downloadCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    marginVertical: 4,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#101622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f293d',
    width: 240,
  },
  documentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#070b13',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  documentName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  documentMetadata: {
    color: '#64748B',
    fontSize: 11,
  },
  documentDownloadIcon: {
    marginLeft: 8,
  },
});
