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
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../styles/theme';

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
    markAsRead,
    connectSocket,
  } = useChatStore();

  const [text, setText] = useState('');
  const chatMessages = messages[chatId || ''] || [];
  const isLoading = loadingMessages[chatId || ''] || false;
  const hasMore = hasMoreMessages[chatId || ''] !== false;

  // Resolve chat title / recipient name
  const currentChat = chats.find((c) => c._id === chatId);
  const recipient = currentChat?.participants.find((p) => p._id !== user?.id);
  const chatTitle = recipient?.displayName || 'Conversation';

  useEffect(() => {
    if (!chatId) return;

    // Connect socket and listen
    connectSocket();
    // Load initial batch of messages
    fetchMessages(chatId);
    // Mark incoming messages as read
    markAsRead(chatId);
  }, [chatId]);

  const handleSend = () => {
    if (!text.trim() || !chatId) return;
    sendMessage(chatId, text.trim());
    setText('');
  };

  const handleLoadMore = () => {
    if (chatId && hasMore && !isLoading) {
      fetchMessages(chatId, true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Custom Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {chatTitle}
          </Text>
          <Text style={styles.connectionStatus}>
            {socketConnected ? '🟢 Online' : '🔴 Reconnecting...'}
          </Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Message List */}
      <FlatList
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
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
              <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                <Text style={[styles.bubbleText, isMe ? styles.myBubbleText : styles.otherBubbleText]}>
                  {item.text}
                </Text>
                <View style={styles.metaRow}>
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
              </View>
            </View>
          );
        }}
      />

      {/* Input container */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textSecondary}
            value={text}
            onChangeText={setText}
            style={styles.textInput}
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
});
