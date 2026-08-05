import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';

const { width, height } = Dimensions.get('window');
const QUICK_EMOJIS = ['😂', '❤️', '😮', '😢', '🙏', '🔥', '👏', '🎉'];

interface FloatingEmoji {
  id: string;
  emoji: string;
  animY: Animated.Value;
  animOpacity: Animated.Value;
}

export default function ViewStatusScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const {
    activeStatuses,
    deleteStatus,
    recordStatusView,
    reactToStatus,
    fetchStatusViewers,
    replyToStatus,
    socket,
  } = useChatStore();

  const userStoryGroup = activeStatuses.find((group) => group.user?._id === userId);
  const items = userStoryGroup?.items || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Status Viewers Modal State
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);

  // Floating reactions animation state
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

  // Custom Confirm Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive' | 'primary'; onPress: () => void }>;
  }>({
    visible: false,
    title: '',
    buttons: [],
  });

  const [progressAnim] = useState(() => new Animated.Value(0));
  const isOwner = currentUser?.id === userStoryGroup?.user?._id;

  const currentItem = items[currentIndex];

  const triggerFloatingEmoji = (emoji: string) => {
    const id = `emoji_${Date.now()}_${Math.random()}`;
    const animY = new Animated.Value(0);
    const animOpacity = new Animated.Value(1);

    setFloatingEmojis((prev) => [...prev, { id, emoji, animY, animOpacity }]);

    Animated.parallel([
      Animated.timing(animY, {
        toValue: -250,
        duration: 1800,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== id));
    });
  };

  const loadViewers = async () => {
    if (!currentItem) return;
    setIsLoadingViewers(true);
    const list = await fetchStatusViewers(currentItem._id);
    setViewersList(list);
    setIsLoadingViewers(false);
  };

  // Record view on status change
  useEffect(() => {
    if (currentItem && !isOwner) {
      recordStatusView(currentItem._id);
    }
  }, [currentIndex, currentItem, isOwner]);

  // Handle Socket live status reactions when owner is watching
  useEffect(() => {
    if (!socket || !isOwner || !currentItem) return;

    const handleStatusReacted = (data: { statusId: string; user: any; emoji: string }) => {
      if (data.statusId === currentItem._id) {
        triggerFloatingEmoji(data.emoji);
        // Refresh viewers list if modal open
        if (showViewersModal) {
          loadViewers();
        }
      }
    };

    socket.on('status_reacted', handleStatusReacted);
    return () => {
      socket.off('status_reacted', handleStatusReacted);
    };
  }, [socket, isOwner, currentItem, showViewersModal]);

  // Story progress timer control
  useEffect(() => {
    if (items.length === 0 || isPaused || showViewersModal) return;

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !isPaused && !showViewersModal) {
        if (currentIndex < items.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          router.back();
        }
      }
    });

    return () => animation.stop();
  }, [currentIndex, items, isPaused, showViewersModal]);

  const handleSendReaction = async (emoji: string) => {
    if (!currentItem) return;
    triggerFloatingEmoji(emoji);
    await reactToStatus(currentItem._id, emoji);
  };

  const handleSendReply = async () => {
    if (!currentItem || !replyText.trim() || isSendingReply) return;
    setIsSendingReply(true);
    const textToSend = replyText;
    setReplyText('');

    const success = await replyToStatus(currentItem._id, textToSend);
    setIsSendingReply(false);
    setIsPaused(false);

    if (success) {
      router.back();
    }
  };

  const handleOpenViewers = () => {
    setIsPaused(true);
    setShowViewersModal(true);
    loadViewers();
  };

  const handleCloseViewers = () => {
    setShowViewersModal(false);
    setIsPaused(false);
  };

  const handleDeleteStatus = () => {
    if (!currentItem) return;
    setIsPaused(true);
    setConfirmModalConfig({
      visible: true,
      title: 'Delete Status Update',
      message: 'Are you sure you want to delete this status update? It will be removed for everyone.',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setIsPaused(false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setShowViewersModal(false);
            const statusIdToDelete = currentItem._id;
            const success = await deleteStatus(statusIdToDelete);
            if (success) {
              if (items.length <= 1) {
                router.back();
              } else {
                setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
                setIsPaused(false);
              }
            } else {
              setConfirmModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to delete status. Please try again.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => setIsPaused(false) }],
              });
            }
          },
        },
      ],
    });
  };

  if (!userStoryGroup || items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Status update unavailable or expired.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: currentItem.mediaUrl ? '#030712' : currentItem.backgroundColor || '#0F172A' },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Progress Bars */}
        <View style={styles.progressContainer}>
          {items.map((st, idx) => (
            <View key={st._id} style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      idx === currentIndex
                        ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : idx < currentIndex
                        ? '100%'
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header Info */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: userStoryGroup.user?.avatarUrl || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.userName}>{userStoryGroup.user?.displayName || 'User'}</Text>
              <Text style={styles.timeAgo}>
                {new Date(currentItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>

          <View style={styles.headerRightActions}>
            {isOwner && (
              <TouchableOpacity style={styles.deleteIconBtn} onPress={handleDeleteStatus}>
                <Text style={styles.deleteIconText}>🗑️</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeIcon} onPress={() => router.back()}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Story Content */}
        <View style={styles.storyContent}>
          {currentItem.mediaUrl ? (
            <Image source={{ uri: currentItem.mediaUrl }} style={styles.storyImage} resizeMode="contain" />
          ) : (
            <Text style={styles.storyText}>{currentItem.text}</Text>
          )}

          {currentItem.caption ? (
            <View style={styles.captionBox}>
              <Text style={styles.captionText}>{currentItem.caption}</Text>
            </View>
          ) : null}

          {/* Reaction Overlay Summary Badge */}
          {currentItem.views && currentItem.views.some((v: any) => v.reaction) && (
            <TouchableOpacity
              style={styles.reactionSummaryBadge}
              onPress={isOwner ? handleOpenViewers : undefined}
              activeOpacity={0.8}
            >
              {Array.from(new Set(currentItem.views.filter((v: any) => v.reaction).map((v: any) => v.reaction)))
                .slice(0, 4)
                .map((emoji: any, i) => (
                  <Text key={i} style={styles.reactionBadgeEmoji}>
                    {emoji}
                  </Text>
                ))}
              <Text style={styles.reactionBadgeCount}>
                {currentItem.views.filter((v: any) => v.reaction).length}
              </Text>
            </TouchableOpacity>
          )}

          {/* Floating Reaction Emojis Animation */}
          {floatingEmojis.map((fe) => (
            <Animated.View
              key={fe.id}
              style={[
                styles.floatingEmojiContainer,
                {
                  transform: [{ translateY: fe.animY }],
                  opacity: fe.animOpacity,
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.floatingEmojiText}>{fe.emoji}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Touch Navigation Overlay */}
        <View style={styles.touchOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.touchLeft}
            onPress={handlePrev}
            activeOpacity={0.9}
          />
          <TouchableOpacity
            style={styles.touchRight}
            onPress={handleNext}
            activeOpacity={0.9}
          />
        </View>

        {/* Bottom Actions */}
        {isOwner ? (
          /* Owner Mode: Views Eye Icon */
          <View style={styles.ownerBottomBar}>
            <TouchableOpacity style={styles.viewsBtn} onPress={handleOpenViewers}>
              <Text style={styles.viewsEyeIcon}>👁️</Text>
              <Text style={styles.viewsCountText}>
                {currentItem.views?.length || 0} {currentItem.views?.length === 1 ? 'view' : 'views'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Viewer Mode: Fast Reaction Bar & Quick Reply Input */
          <View style={styles.viewerBottomBar}>
            {/* Fast Emoji Reactions */}
            <View style={styles.fastReactionsContainer}>
              {QUICK_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => handleSendReaction(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Reply Input */}
            <View style={styles.replyInputContainer}>
              <TextInput
                style={styles.replyTextInput}
                placeholder={`Reply to ${userStoryGroup.user?.displayName || 'status'}...`}
                placeholderTextColor="rgba(248, 250, 252, 0.6)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setIsPaused(true)}
                onBlur={() => {
                  if (!replyText) setIsPaused(false);
                }}
              />
              <TouchableOpacity
                style={[
                  styles.sendReplyBtn,
                  { backgroundColor: replyText.trim() ? '#F59E0B' : 'rgba(255,255,255,0.2)' },
                ]}
                onPress={handleSendReply}
                disabled={!replyText.trim() || isSendingReply}
              >
                <Text style={styles.sendReplyText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Viewers Bottom Sheet Modal */}
      <Modal
        visible={showViewersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseViewers}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={handleCloseViewers} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Viewed by {viewersList.length} {viewersList.length === 1 ? 'person' : 'people'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity onPress={handleDeleteStatus}>
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>🗑️ Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCloseViewers}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {isLoadingViewers ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading viewers...</Text>
              </View>
            ) : viewersList.length === 0 ? (
              <View style={styles.emptyViewersContainer}>
                <Text style={styles.emptyViewersText}>No views yet</Text>
              </View>
            ) : (
              <FlatList
                data={viewersList}
                keyExtractor={(item, index) => item.user?._id || index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.viewerRow}>
                    <Image
                      source={{ uri: item.user?.avatarUrl || 'https://via.placeholder.com/150' }}
                      style={styles.viewerAvatar}
                    />
                    <View style={styles.viewerInfo}>
                      <Text style={styles.viewerName}>{item.user?.displayName || 'User'}</Text>
                      <Text style={styles.viewerTime}>
                        {new Date(item.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {item.reaction ? (
                      <View style={styles.viewerReactionBadge}>
                        <Text style={styles.viewerReactionEmoji}>{item.reaction}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Dark Confirm Dialog Modal */}
      <CustomConfirmModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        buttons={confirmModalConfig.buttons}
        onClose={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
    zIndex: 20,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  timeAgo: {
    color: 'rgba(248, 250, 252, 0.7)',
    fontSize: 11,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  deleteIconText: {
    fontSize: 16,
  },
  closeIcon: {
    padding: 6,
  },
  closeIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '80%',
    borderRadius: 16,
  },
  storyText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  captionBox: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '90%',
  },
  captionText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
  reactionSummaryBadge: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    gap: 4,
  },
  reactionBadgeEmoji: {
    fontSize: 16,
  },
  reactionBadgeCount: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 4,
  },
  floatingEmojiContainer: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    zIndex: 50,
  },
  floatingEmojiText: {
    fontSize: 48,
  },
  touchOverlay: {
    position: 'absolute',
    top: 80,
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 10,
  },
  touchLeft: {
    width: '35%',
    height: '100%',
  },
  touchRight: {
    width: '65%',
    height: '100%',
  },
  ownerBottomBar: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  viewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  viewsEyeIcon: {
    fontSize: 18,
  },
  viewsCountText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerBottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 30,
  },
  fastReactionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  emojiBtn: {
    padding: 6,
  },
  emojiText: {
    fontSize: 24,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 10,
  },
  replyTextInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 6,
  },
  sendReplyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sendReplyText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    maxHeight: height * 0.6,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyViewersContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyViewersText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  viewerTime: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  viewerReactionBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  viewerReactionEmoji: {
    fontSize: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 16,
    marginBottom: 16,
  },
  closeBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
