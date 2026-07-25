import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Message } from '../store/chatStore';
import { COLORS } from '../styles/theme';
import { MediaMessage } from './MediaMessage';
import * as FileSystem from 'expo-file-system/legacy';

interface MemoizedMessageItemProps {
  item: Message;
  isMe: boolean;
  isGroup: boolean;
  userId: string;
  isSelected: boolean;
  isSelectionMode: boolean;
  isHighlighted: boolean;
  uploadProgress?: number;
  onReply: () => void;
  onLongPress: (msg: Message) => void;
  onSelect: (msgId: string) => void;
  onMediaPress: (mediaInfo: { messageId: string; url: string; type: 'image' | 'video' | 'audio' }) => void;
  onCancelUpload: (tempId: string) => void;
}

const triggerHaptic = () => {
  Vibration.vibrate(15);
};

const MemoizedMessageItemComponent: React.FC<MemoizedMessageItemProps> = ({
  item,
  isMe,
  isGroup,
  userId,
  isSelected,
  isSelectionMode,
  isHighlighted,
  uploadProgress,
  onReply,
  onLongPress,
  onSelect,
  onMediaPress,
  onCancelUpload,
}) => {
  const translateX = useSharedValue(0);
  const hasVibrated = useSharedValue(false);

  const onlyMedia = Boolean(item.mediaUrl && !item.text && !item.isDeleted);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (item.isDeleted) return;
      const translation = event.translationX;
      // Swipe right for other's messages, swipe left for sent messages
      if ((isMe && translation < 0) || (!isMe && translation > 0)) {
        translateX.value = translation * 0.4;
        if (Math.abs(translation) > 50 && !hasVibrated.value) {
          hasVibrated.value = true;
          runOnJS(triggerHaptic)();
        }
      }
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) > 20) {
        runOnJS(onReply)();
      }
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      hasVibrated.value = false;
    });

  const animatedRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedReplyIconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / 20, 1),
    transform: [{ scale: Math.min(Math.abs(translateX.value) / 20, 1) }],
  }));

  const handleMediaTap = async () => {
    if (item.status !== 'sending' && item.mediaUrl && item.mediaType) {
      const fileExtension =
        item.mediaType === 'video' ? 'mp4' : item.mediaType === 'audio' ? 'm4a' : 'jpg';
      const localPath = `${FileSystem.documentDirectory}media_${item._id}.${fileExtension}`;
      const info = await FileSystem.getInfoAsync(localPath);
      const activeUrl = info.exists ? localPath : item.mediaUrl;

      onMediaPress({
        messageId: item._id,
        url: activeUrl,
        type: item.mediaType as 'image' | 'video' | 'audio',
      });
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.outerRowContainer, animatedRowStyle]}>
        {/* Reply Indicator Icon */}
        <Animated.View
          style={[
            styles.replyIndicator,
            isMe ? styles.replyIndicatorLeft : styles.replyIndicatorRight,
            animatedReplyIconStyle,
          ]}
        >
          <Text style={styles.replyIconText}>↩</Text>
        </Animated.View>

        <View style={[styles.messageRowWrapper, isSelected && styles.selectedRowHighlight]}>
          <TouchableOpacity
            onPress={() => {
              if (isSelectionMode) {
                onSelect(item._id);
              }
            }}
            onLongPress={() => {
              if (isSelectionMode) {
                onSelect(item._id);
              } else {
                onLongPress(item);
              }
            }}
            activeOpacity={0.85}
            style={[
              styles.messageRow,
              isMe ? styles.myMessageRow : styles.otherMessageRow,
              isSelectionMode && { flex: 1 },
            ]}
          >
            <View
              style={[
                styles.bubble,
                isMe ? styles.myBubble : styles.otherBubble,
                onlyMedia && styles.onlyMediaBubble,
                isHighlighted && styles.highlightedBubble,
              ]}
            >
              {/* Group Sender Name */}
              {isGroup && !isMe && (
                <Text style={styles.groupSenderName}>
                  {item.sender?.displayName || 'Someone'}
                </Text>
              )}

              {/* Replied-To Message Header inside bubble */}
              {item.replyTo && !item.isDeleted && (
                <View
                  style={[
                    styles.bubbleReplyPreview,
                    isMe ? styles.myBubbleReplyPreview : styles.otherBubbleReplyPreview,
                  ]}
                >
                  <Text style={styles.bubbleReplySender} numberOfLines={1}>
                    {item.replyTo.sender._id === userId ? 'You' : item.replyTo.sender.displayName}
                  </Text>
                  <Text style={styles.bubbleReplyText} numberOfLines={1}>
                    {item.replyTo.text}
                  </Text>
                </View>
              )}

              {/* Forwarded Tag */}
              {item.isForwarded && !item.isDeleted && (
                <Text style={[styles.forwardedText, isMe ? styles.myForwardedText : styles.otherForwardedText]}>
                  ↪ Forwarded
                </Text>
              )}

              {/* Media Content */}
              {item.mediaUrl && item.mediaType && !item.isDeleted && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={handleMediaTap}
                  style={{ marginBottom: item.text ? 8 : 0 }}
                >
                  <MediaMessage
                    messageId={item._id}
                    mediaUrl={item.mediaUrl}
                    mediaType={item.mediaType}
                    mediaWidth={item.mediaWidth}
                    mediaHeight={item.mediaHeight}
                    mediaDuration={item.mediaDuration}
                    isSending={item.status === 'sending'}
                    progress={uploadProgress}
                    onCancel={() => onCancelUpload(item.tempId || '')}
                  />
                </TouchableOpacity>
              )}

              {/* Message Text */}
              {(item.text ? true : false || item.isDeleted) && (
                <Text
                  style={[
                    styles.bubbleText,
                    isMe ? styles.myBubbleText : styles.otherBubbleText,
                    item.isDeleted && styles.deletedBubbleText,
                  ]}
                >
                  {item.text}
                </Text>
              )}

              {/* Time & Status Row */}
              {!item.isDeleted && (
                <View style={onlyMedia ? styles.metaRowOnlyMedia : styles.metaRow}>
                  {item.isEdited && <Text style={styles.editedText}>(edited)</Text>}
                  <Text style={onlyMedia ? styles.timeTextOnlyMedia : styles.timeText}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {isMe && (
                    <Text
                      style={[
                        onlyMedia ? styles.statusTextOnlyMedia : styles.statusText,
                        item.status === 'read' && styles.statusRead,
                      ]}
                    >
                      {item.status === 'sending' ? '⏳' : item.status === 'read' ? '✓✓' : '✓'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const arePropsEqual = (prevProps: MemoizedMessageItemProps, nextProps: MemoizedMessageItemProps) => {
  return (
    prevProps.item._id === nextProps.item._id &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.text === nextProps.item.text &&
    prevProps.item.isDeleted === nextProps.item.isDeleted &&
    prevProps.item.isEdited === nextProps.item.isEdited &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.uploadProgress === nextProps.uploadProgress &&
    prevProps.isMe === nextProps.isMe &&
    prevProps.isGroup === nextProps.isGroup
  );
};

export const MemoizedMessageItem = React.memo(MemoizedMessageItemComponent, arePropsEqual);

const styles = StyleSheet.create({
  outerRowContainer: {
    width: '100%',
    position: 'relative',
  },
  replyIndicator: {
    position: 'absolute',
    top: '25%',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  replyIndicatorLeft: {
    right: 12,
  },
  replyIndicatorRight: {
    left: 12,
  },
  replyIconText: {
    fontSize: 18,
    color: COLORS.primary,
  },
  messageRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 8,
  },
  selectedRowHighlight: {
    backgroundColor: 'rgba(204, 255, 0, 0.16)',
    paddingVertical: 2,
  },
  selectionCheckboxWrapper: {
    paddingRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxCheckmark: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    width: '100%',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onlyMediaBubble: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  highlightedBubble: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  selectedBubble: {
    opacity: 0.8,
  },
  groupSenderName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 4,
  },
  bubbleReplyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    width: '100%',
  },
  myBubbleReplyPreview: {
    borderLeftColor: '#000',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  otherBubbleReplyPreview: {
    borderLeftColor: COLORS.primary,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bubbleReplySender: {
    fontWeight: '700',
    fontSize: 11,
    color: COLORS.primary,
    marginBottom: 1,
  },
  bubbleReplyText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  forwardedText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 3,
  },
  myForwardedText: {
    color: 'rgba(0,0,0,0.5)',
  },
  otherForwardedText: {
    color: COLORS.textSecondary,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myBubbleText: {
    color: COLORS.primaryText,
    fontWeight: '500',
  },
  otherBubbleText: {
    color: COLORS.textPrimary,
  },
  deletedBubbleText: {
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    opacity: 0.8,
  },
  metaRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  metaRowOnlyMedia: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  timeTextOnlyMedia: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  editedText: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginRight: 2,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  statusTextOnlyMedia: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  statusRead: {
    color: COLORS.primary,
  },
});
