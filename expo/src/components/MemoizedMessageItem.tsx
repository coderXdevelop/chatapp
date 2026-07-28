import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Image,
  Linking,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
  onReact?: (emoji: string) => void;
  onOpenEmojiPicker?: (msg: Message) => void;
  onSelect: (msgId: string) => void;
  onMediaPress: (mediaInfo: { messageId: string; url: string; type: 'image' | 'video' | 'audio' }) => void;
  onCancelUpload: (tempId: string) => void;
  onPressReplyPreview?: (replyToId: string) => void;
  onPressStatusReplyPreview?: (statusReply: any) => void;
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
  onReact,
  onOpenEmojiPicker,
  onSelect,
  onMediaPress,
  onCancelUpload,
  onPressReplyPreview,
  onPressStatusReplyPreview,
}) => {
  const [showQuickReactions, setShowQuickReactions] = React.useState(false);
  const translateX = useSharedValue(0);
  const hasVibrated = useSharedValue(false);

  const onlyMedia = Boolean(item.mediaUrl && !item.text && !item.isDeleted);
  const isSticker = Boolean(item.mediaType === 'sticker' && !item.isDeleted);
  const hasReactions = Array.isArray(item.reactions) && item.reactions.length > 0 && !item.isDeleted;
  const groupedReactions = React.useMemo(() => {
    if (!hasReactions || !item.reactions) return {};
    const map: Record<string, number> = {};
    for (const r of item.reactions) {
      const emojiStr = typeof r === 'string' ? r : r?.emoji;
      if (emojiStr) {
        map[emojiStr] = (map[emojiStr] || 0) + 1;
      }
    }
    return map;
  }, [item.reactions, hasReactions]);

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
      <Animated.View
        style={[
          styles.outerRowContainer,
          isSelected && styles.selectedRowHighlight,
          animatedRowStyle,
        ]}
      >
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

        <View
          style={[
            styles.messageRow,
            isMe ? styles.myMessageRow : styles.otherMessageRow,
            hasReactions && { marginBottom: 10 },
          ]}
        >
          <View style={[styles.bubbleWrapper, isSticker && styles.stickerBubbleWrapper]}>
            {/* WhatsApp Style Floating Quick Reaction Bar */}
            {showQuickReactions && !item.isDeleted && (
              <View style={[styles.floatingReactionToolbar, isMe ? styles.myFloatingToolbar : styles.otherFloatingToolbar]}>
                {['👍', '❤️', '😂', '😮', '😢', '🙏', '😴'].map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => {
                      if (onReact) onReact(emoji);
                      setShowQuickReactions(false);
                      triggerHaptic();
                    }}
                    style={styles.floatingEmojiItem}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.floatingEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => {
                    setShowQuickReactions(false);
                    triggerHaptic();
                    if (onOpenEmojiPicker) onOpenEmojiPicker(item);
                  }}
                  style={styles.floatingPlusItem}
                  activeOpacity={0.75}
                >
                  <View style={styles.plusCircle}>
                    <Text style={styles.plusIconText}>+</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => {
                if (showQuickReactions) {
                  setShowQuickReactions(false);
                } else if (isSelectionMode) {
                  onSelect(item._id);
                }
              }}
              onLongPress={() => {
                if (isSelectionMode) {
                  onSelect(item._id);
                } else {
                  setShowQuickReactions((prev) => !prev);
                  onLongPress(item);
                }
              }}
              activeOpacity={0.85}
              style={[
                styles.bubble,
                isMe ? styles.myBubble : styles.otherBubble,
                onlyMedia && styles.onlyMediaBubble,
                isSticker && styles.stickerBubble,
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
                <TouchableOpacity
                  style={[
                    styles.bubbleReplyPreview,
                    isMe ? styles.myBubbleReplyPreview : styles.otherBubbleReplyPreview,
                  ]}
                  onPress={() => item.replyTo?._id && onPressReplyPreview?.(item.replyTo._id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.bubbleReplySender} numberOfLines={1}>
                    {item.replyTo.sender._id === userId ? 'You' : item.replyTo.sender.displayName}
                  </Text>
                  <Text style={styles.bubbleReplyText} numberOfLines={1}>
                    {item.replyTo.text}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Status Reply Header inside bubble */}
              {item.statusReply && !item.isDeleted && (
                <TouchableOpacity
                  style={[
                    styles.statusReplyPreview,
                    isMe ? styles.myStatusReplyPreview : styles.otherStatusReplyPreview,
                  ]}
                  onPress={() => item.statusReply && onPressStatusReplyPreview?.(item.statusReply)}
                  activeOpacity={0.75}
                >
                  {item.statusReply.mediaUrl ? (
                    <Image
                      source={{ uri: item.statusReply.mediaUrl }}
                      style={styles.statusReplyThumb}
                    />
                  ) : (
                    <View
                      style={[
                        styles.statusReplyColorThumb,
                        { backgroundColor: item.statusReply.backgroundColor || '#F59E0B' },
                      ]}
                    >
                      <Text style={styles.statusReplyColorThumbText} numberOfLines={1}>
                        {(item.statusReply.text || 'Status').substring(0, 8)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={styles.statusReplySender} numberOfLines={1}>
                      📷 Status
                    </Text>
                    <Text style={styles.statusReplyText} numberOfLines={1}>
                      {item.statusReply.caption || item.statusReply.text || 'Status Update'}
                    </Text>
                  </View>
                </TouchableOpacity>
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
                  style={isSticker ? styles.stickerMediaContainer : { marginBottom: item.text ? 8 : 0 }}
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

              {/* Rich Link Preview Card */}
              {item.linkPreview && item.linkPreview.url && !item.isDeleted && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => item.linkPreview?.url && Linking.openURL(item.linkPreview.url)}
                  style={styles.linkPreviewContainer}
                >
                  {item.linkPreview.image ? (
                    <View style={styles.linkPreviewImageWrapper}>
                      <Image source={{ uri: item.linkPreview.image }} style={styles.linkPreviewImage} resizeMode="cover" />
                      {(item.linkPreview.domain?.includes('youtube') || item.linkPreview.domain?.includes('youtu.be')) && (
                        <View style={styles.playButtonOverlay}>
                          <Text style={styles.playButtonIcon}>▶</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                  <View style={styles.linkPreviewContent}>
                    <Text style={styles.linkPreviewDomain} numberOfLines={1}>
                      🌐 {item.linkPreview.domain || 'Link'}
                    </Text>
                    <Text style={styles.linkPreviewTitle} numberOfLines={2}>
                      {item.linkPreview.title}
                    </Text>
                    {item.linkPreview.description ? (
                      <Text style={styles.linkPreviewDesc} numberOfLines={2}>
                        {item.linkPreview.description}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}

              {/* Time & Status Row */}
              {!item.isDeleted && (
                <View style={isSticker ? styles.metaRowSticker : onlyMedia ? styles.metaRowOnlyMedia : styles.metaRow}>
                  {item.isEdited && <Text style={styles.editedText}>(edited)</Text>}
                  <Text style={isSticker || onlyMedia ? styles.timeTextOnlyMedia : styles.timeText}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {isMe && (
                    <Text
                      style={[
                        isSticker || onlyMedia ? styles.statusTextOnlyMedia : styles.statusText,
                        item.status === 'read' && styles.statusRead,
                        item.status === 'delivered' && styles.statusDelivered,
                      ]}
                    >
                      {item.status === 'sending' ? '⏳' : item.status === 'read' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* Active Reactions Badge (WhatsApp-Style Floating Overlap Pill) */}
            {hasReactions && (
              <View style={[styles.reactionsBadge, isMe ? styles.myReactionsBadge : styles.otherReactionsBadge]}>
                {Object.entries(groupedReactions).map(([emoji, count]) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => onReact && onReact(emoji)}
                    activeOpacity={0.7}
                    style={styles.reactionPill}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                    {count > 1 && <Text style={styles.reactionCountText}>{count}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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
    prevProps.isGroup === nextProps.isGroup &&
    JSON.stringify(prevProps.item.reactions) === JSON.stringify(nextProps.item.reactions) &&
    JSON.stringify(prevProps.item.linkPreview) === JSON.stringify(nextProps.item.linkPreview)
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'flex-end',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubbleWrapper: {
    position: 'relative',
    maxWidth: '80%',
  },
  bubble: {
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
    paddingLeft: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 6,
  },
  myBubbleReplyPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderLeftColor: '#F59E0B',
  },
  otherBubbleReplyPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderLeftColor: COLORS.primary,
  },
  statusReplyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    padding: 6,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  myStatusReplyPreview: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderLeftColor: '#F59E0B',
  },
  otherStatusReplyPreview: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderLeftColor: '#F59E0B',
  },
  statusReplyThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  statusReplyColorThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  statusReplyColorThumbText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusReplySender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 2,
  },
  statusReplyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
  statusDelivered: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  statusRead: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  linkPreviewContainer: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
  },
  linkPreviewImageWrapper: {
    position: 'relative',
    width: '100%',
    height: 140,
    backgroundColor: '#1E293B',
  },
  linkPreviewImage: {
    width: '100%',
    height: 140,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '35%',
    left: '42%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  playButtonIcon: {
    color: '#F59E0B',
    fontSize: 18,
    marginLeft: 2,
  },
  linkPreviewContent: {
    padding: 10,
    backgroundColor: '#0F172A',
  },
  linkPreviewDomain: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  linkPreviewTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 4,
  },
  linkPreviewDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  floatingReactionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginVertical: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  myFloatingToolbar: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  otherFloatingToolbar: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  floatingEmojiItem: {
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  floatingEmojiText: {
    fontSize: 23,
  },
  floatingPlusItem: {
    paddingLeft: 4,
  },
  plusCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconText: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '600',
    marginTop: -2,
  },
  reactionsBadge: {
    position: 'absolute',
    bottom: -10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#334155',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 6,
    zIndex: 10,
  },
  myReactionsBadge: {
    right: 12,
  },
  otherReactionsBadge: {
    left: 12,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reactionEmojiText: {
    fontSize: 13,
  },
  reactionCountText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  stickerBubbleWrapper: {
    maxWidth: 160,
    alignItems: 'flex-start',
  },
  stickerBubble: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'flex-start',
  },
  stickerMediaContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRowSticker: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
});
