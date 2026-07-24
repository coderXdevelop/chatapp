import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Vibration,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../styles/theme';

// Swipeable message row wrapper component
const SwipeableRow = ({
  item,
  children,
  onReply,
  isMe,
}: {
  item: Message;
  children: React.ReactNode;
  onReply: () => void;
  isMe: boolean;
}) => {
  const swipeableRef = useRef<any>(null);

  const renderLeftActions = () => {
    return (
      <View style={styles.replyIconContainerLeft}>
        <Text style={styles.replyIconText}>↩</Text>
      </View>
    );
  };

  const renderRightActions = () => {
    return (
      <View style={styles.replyIconContainerRight}>
        <Text style={styles.replyIconText}>↩</Text>
      </View>
    );
  };

  const handleSwipeWillOpen = () => {
    if (swipeableRef.current) {
      swipeableRef.current.close();
    }
    Vibration.vibrate(15);
    onReply();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={50}
      rightThreshold={50}
      renderLeftActions={!isMe && !item.isDeleted ? renderLeftActions : undefined}
      renderRightActions={isMe && !item.isDeleted ? renderRightActions : undefined}
      onSwipeableWillOpen={handleSwipeWillOpen}
    >
      {children}
    </Swipeable>
  );
};

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    chats,
    messages,
    loadingMessages,
    hasMoreMessages,
    socketConnected,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    connectSocket,
    typingStates,
    sendTypingStart,
    sendTypingStop,
  } = useChatStore();

  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  
  // States for long press options menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // States for viewing user profile details and viewing avatar fullscreen
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);

  const chatMessages = messages[chatId || ''] || [];
  const isLoading = loadingMessages[chatId || ''] || false;
  const hasMore = hasMoreMessages[chatId || ''] !== false;

  // Resolve chat title / recipient name
  const currentChat = chats.find((c) => c._id === chatId);
  const recipient = currentChat?.participants.find((p) => p._id !== user?.id);
  const chatTitle = recipient?.displayName || 'Conversation';

  const flatListRef = useRef<FlatList>(null);

  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Offline';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Last seen just now';
      if (diffMins < 60) return `Last seen ${diffMins}m ago`;
      if (diffHours < 24) {
        return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return `Last seen on ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    } catch {
      return 'Offline';
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (!chatId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStart(chatId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop(chatId);
      isTypingRef.current = false;
    }, 3000);
  };

  useEffect(() => {
    if (!chatId) return;

    connectSocket();
    fetchMessages(chatId);
    markAsRead(chatId);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (chatId && isTypingRef.current) {
        sendTypingStop(chatId);
      }
    };
  }, [chatId]);

  const handleSend = async () => {
    if (!text.trim() || !chatId) return;

    // Instantly stop typing indicators on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingStop(chatId);
    isTypingRef.current = false;

    if (editingMessage) {
      const success = await editMessage(chatId, editingMessage._id, text.trim());
      if (success) {
        setEditingMessage(null);
        setText('');
      } else {
        Alert.alert('Error', 'Failed to edit message.');
      }
    } else {
      sendMessage(chatId, text.trim(), replyingTo?._id);
      setReplyingTo(null);
      setText('');
    }
  };

  const handleLoadMore = () => {
    if (chatId && hasMore && !isLoading) {
      fetchMessages(chatId, true);
    }
  };

  const handleLongPressMessage = (msg: Message) => {
    if (msg.isDeleted) return;
    Vibration.vibrate(10);
    setSelectedMessage(msg);
    setIsMenuOpen(true);
  };

  const handleDeleteMessage = (msg: Message) => {
    const isMe = msg.sender._id === user?.id;
    const options: any[] = [
      {
        text: 'Delete for me',
        onPress: async () => {
          if (chatId) {
            const success = await deleteMessage(chatId, msg._id, 'me');
            if (!success) {
              Alert.alert('Error', 'Failed to delete message.');
            }
          }
        },
      },
    ];

    if (isMe) {
      options.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          if (chatId) {
            const success = await deleteMessage(chatId, msg._id, 'everyone');
            if (!success) {
              Alert.alert('Error', 'Failed to delete message.');
            }
          }
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(
      'Delete Message',
      isMe
        ? 'Do you want to delete this message for yourself, or for everyone?'
        : 'Do you want to delete this message for yourself?',
      options
    );
  };

  const handleForwardMessage = (msg: Message) => {
    router.push({
      pathname: '/forward',
      params: { messageIds: [msg._id] },
    } as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Custom Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => recipient && setIsProfileModalOpen(true)}
          style={styles.headerTitleContainer}
          activeOpacity={0.7}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chatTitle}
          </Text>
          <Text
            style={[
              styles.connectionStatus,
              recipient && typingStates[chatId || '']?.includes(recipient._id) && {
                color: COLORS.primary,
                fontWeight: '700',
              },
            ]}
          >
            {!socketConnected
              ? '🔴 Reconnecting...'
              : recipient && typingStates[chatId || '']?.includes(recipient._id)
              ? 'typing...'
              : recipient?.isOnline
              ? '🟢 Online'
              : formatLastSeen(recipient?.lastSeen)}
          </Text>
        </TouchableOpacity>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item) => item._id}
        inverted // Renders list from bottom to top
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={
          isLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 12 }} />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isMe = item.sender._id === user?.id;
          return (
            <SwipeableRow item={item} isMe={isMe} onReply={() => setReplyingTo(item)}>
              <TouchableOpacity
                onLongPress={() => handleLongPressMessage(item)}
                activeOpacity={0.8}
                style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}
              >
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                  {/* Replied-To Message Header inside the bubble */}
                  {item.replyTo && !item.isDeleted && (
                    <View
                      style={[
                        styles.bubbleReplyPreview,
                        isMe ? styles.myBubbleReplyPreview : styles.otherBubbleReplyPreview,
                      ]}
                    >
                      <Text style={styles.bubbleReplySender} numberOfLines={1}>
                        {item.replyTo.sender._id === user?.id ? 'You' : item.replyTo.sender.displayName}
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

                  <Text
                    style={[
                      styles.bubbleText,
                      isMe ? styles.myBubbleText : styles.otherBubbleText,
                      item.isDeleted && styles.deletedBubbleText,
                    ]}
                  >
                    {item.text}
                  </Text>
                  
                  {!item.isDeleted && (
                    <View style={styles.metaRow}>
                      {item.isEdited && <Text style={styles.editedText}>(edited)</Text>}
                      <Text style={styles.timeText}>
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      {isMe && (
                        <Text style={[styles.statusText, item.status === 'read' && styles.statusRead]}>
                          {item.status === 'sending' ? '⏳' : item.status === 'read' ? '✓✓' : '✓'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </SwipeableRow>
          );
        }}
      />

      {/* Reply Preview Banner */}
      {replyingTo && (
        <View style={styles.replyBanner}>
          <View style={styles.replyBannerBorder} />
          <View style={styles.replyBannerContent}>
            <Text style={styles.replyBannerSender}>
              Replying to {replyingTo.sender._id === user?.id ? 'yourself' : replyingTo.sender.displayName}
            </Text>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              {replyingTo.text}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseButton}>
            <Text style={styles.replyCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <View style={styles.replyBanner}>
          <View style={[styles.replyBannerBorder, { backgroundColor: COLORS.primary }]} />
          <View style={styles.replyBannerContent}>
            <Text style={[styles.replyBannerSender, { color: COLORS.primary }]}>
              Editing Message
            </Text>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              {editingMessage.text}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditingMessage(null);
              setText('');
            }}
            style={styles.replyCloseButton}
          >
            <Text style={styles.replyCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input container */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            placeholderTextColor={COLORS.textSecondary}
            value={text}
            onChangeText={handleTextChange}
            style={styles.textInput}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          >
            <Text style={styles.sendButtonText}>{editingMessage ? 'Update' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Long Press Actions Modal */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsMenuOpen(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle} numberOfLines={1}>
              Message Actions
            </Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (selectedMessage) setReplyingTo(selectedMessage);
                setIsMenuOpen(false);
              }}
            >
              <Text style={styles.menuItemText}>↩ Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                if (selectedMessage) handleForwardMessage(selectedMessage);
                setIsMenuOpen(false);
              }}
            >
              <Text style={styles.menuItemText}>➡️ Forward</Text>
            </TouchableOpacity>

            {selectedMessage?.sender._id === user?.id && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (selectedMessage) {
                    setEditingMessage(selectedMessage);
                    setText(selectedMessage.text);
                  }
                  setIsMenuOpen(false);
                }}
              >
                <Text style={styles.menuItemText}>✏️ Edit</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDelete]}
              onPress={() => {
                if (selectedMessage) handleDeleteMessage(selectedMessage);
                setIsMenuOpen(false);
              }}
            >
              <Text style={styles.menuItemDeleteText}>🗑️ Delete Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancelButton} onPress={() => setIsMenuOpen(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* User Profile Modal */}
      <Modal
        visible={isProfileModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsProfileModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsProfileModalOpen(false)}
        >
          <TouchableOpacity
            style={styles.profileModalContainer}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header/Close bar */}
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>Contact Info</Text>
              <TouchableOpacity
                style={styles.profileCloseButton}
                onPress={() => setIsProfileModalOpen(false)}
              >
                <Text style={styles.profileCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Avatar Section */}
            <View style={styles.profileAvatarSection}>
              <TouchableOpacity
                onPress={() => {
                  if (recipient?.avatarUrl) {
                    setIsAvatarViewerOpen(true);
                  }
                }}
                activeOpacity={recipient?.avatarUrl ? 0.8 : 1}
                style={styles.profileAvatarWrapper}
              >
                {recipient?.avatarUrl ? (
                  <Image source={{ uri: recipient.avatarUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileAvatarPlaceholder}>
                    <Text style={styles.profileAvatarInitial}>
                      {(recipient?.displayName || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {recipient?.avatarUrl && (
                  <View style={styles.viewAvatarBadge}>
                    <Text style={styles.viewAvatarBadgeText}>🔍 View</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Profile Info Fields */}
            <View style={styles.profileInfoList}>
              {/* Display Name */}
              <View style={styles.profileInfoItem}>
                <Text style={styles.profileLabel}>USER NAME</Text>
                <Text style={styles.profileValue}>{recipient?.displayName || 'ChatConnect User'}</Text>
              </View>

              <View style={styles.profileDivider} />

              {/* User ID / connectId */}
              <View style={styles.profileInfoItem}>
                <Text style={styles.profileLabel}>USER ID</Text>
                <Text style={styles.profileValueMono}>{recipient?.connectId ? `@${recipient.connectId}` : 'Not Allocated'}</Text>
              </View>

              <View style={styles.profileDivider} />

              {/* Age */}
              <View style={styles.profileInfoItem}>
                <Text style={styles.profileLabel}>AGE</Text>
                <Text style={styles.profileValue}>{recipient?.age ? `${recipient.age} years old` : 'Not specified'}</Text>
              </View>

              <View style={styles.profileDivider} />

              {/* Status */}
              <View style={styles.profileInfoItem}>
                <Text style={styles.profileLabel}>STATUS</Text>
                <Text style={styles.profileValueStatus}>{recipient?.status || 'No status message.'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.profileConfirmButton}
              onPress={() => setIsProfileModalOpen(false)}
            >
              <Text style={styles.profileConfirmText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Avatar Viewer Modal */}
      <Modal
        visible={isAvatarViewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAvatarViewerOpen(false)}
      >
        <TouchableOpacity
          style={styles.viewerOverlay}
          activeOpacity={1}
          onPress={() => setIsAvatarViewerOpen(false)}
        >
          {/* Close button top right */}
          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={() => setIsAvatarViewerOpen(false)}
          >
            <Text style={styles.viewerCloseText}>✕ Close</Text>
          </TouchableOpacity>

          {recipient?.avatarUrl && (
            <Image
              source={{ uri: recipient.avatarUrl }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  backButton: {
    paddingVertical: 4,
    width: 60,
  },
  backText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  connectionStatus: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  headerRightPlaceholder: {
    width: 60,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    backgroundColor: COLORS.primary, // Neon lime green
    borderTopRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: COLORS.cardBackground, // Deep slate card container
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myBubbleText: {
    color: COLORS.primaryText, // Deep slate
    fontWeight: '500',
  },
  otherBubbleText: {
    color: COLORS.textPrimary, // White text
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
  timeText: {
    fontSize: 10,
    color: COLORS.textSecondary,
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
  statusRead: {
    color: COLORS.primary, // Bright neon checkmark for read state
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#03050a', // Ultra dark background for typing
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: COLORS.primaryText,
    fontWeight: '800',
    fontSize: 15,
  },
  // Swipeable structures
  replyIconContainerLeft: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 30,
    marginVertical: 4,
    marginRight: 10,
  },
  replyIconContainerRight: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 30,
    marginVertical: 4,
    marginLeft: 10,
  },
  replyIconText: {
    fontSize: 22,
    color: COLORS.primary,
  },
  // Reply banner above input
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyBannerBorder: {
    width: 4,
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  replyBannerContent: {
    flex: 1,
  },
  replyBannerSender: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyBannerText: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  replyCloseButton: {
    padding: 6,
  },
  replyCloseText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  // Inner bubble reply preview styling
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
  // Forwarded text indicator
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
  // Modal styles for message options
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  menuTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemDelete: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemDeleteText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  menuCancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
  },
  menuCancelText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  // Profile Modal Styles
  profileModalContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: '100%',
    maxHeight: '90%',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  profileCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileCloseText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  profileAvatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatarWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.background,
    borderWidth: 3,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  profileAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarInitial: {
    fontSize: 48,
    fontWeight: '800',
    color: '#070b13',
  },
  viewAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  viewAvatarBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profileInfoList: {
    backgroundColor: '#03050a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  profileInfoItem: {
    paddingVertical: 10,
  },
  profileLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  profileValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  profileValueMono: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  profileValueStatus: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  profileDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  profileConfirmButton: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileConfirmText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  // Fullscreen Viewer Styles
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
  },
  viewerCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
});
