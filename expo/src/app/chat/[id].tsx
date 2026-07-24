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
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { MediaMessage } from '../../components/MediaMessage';
import { pickMedia, compressImage, uploadToCloudinary, getCloudinarySignature } from '../../services/mediaUpload';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

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
    addOptimisticMessage,
    removeMessage,
    sendFinalizedMessage,
  } = useChatStore();

  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState<{ current: number; total: number } | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ messageId: string; url: string; type: 'image' | 'video' | 'audio' } | null>(null);

  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();
  
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeUploadsRef = useRef<Record<string, AbortController>>({});
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, number>>({});

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

  const handleAttachPress = () => {
    setIsMediaMenuOpen(true);
  };

  const handleCancelParticularUpload = (tempId: string) => {
    const controller = activeUploadsRef.current[tempId];
    if (controller) {
      controller.abort();
      delete activeUploadsRef.current[tempId];
    }
    removeMessage(chatId!, tempId);
    setUploadProgressMap((prev) => {
      const updated = { ...prev };
      delete updated[tempId];
      return updated;
    });
  };

  const downloadMediaFile = async (url: string, type: 'image' | 'video' | 'audio') => {
    try {
      const fileExtension = type === 'video' ? 'mp4' : type === 'audio' ? 'm4a' : 'jpg';
      const filename = `ChatConnect_${Date.now()}.${fileExtension}`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(url, localUri);

      let saved = false;
      try {
        const MediaLibrary = require('expo-media-library');
        if (MediaLibrary) {
          const permission = await MediaLibrary.requestPermissionsAsync();
          if (permission.granted) {
            await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
            saved = true;
            Alert.alert('Saved', 'Media successfully saved to your photos gallery!');
          }
        }
      } catch (mediaErr) {
        console.warn('Native MediaLibrary is not available in this client, falling back to Sharing.', mediaErr);
      }

      if (!saved) {
        try {
          const Sharing = require('expo-sharing');
          if (Sharing && await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadResult.uri);
          } else {
            Alert.alert('Download Complete', `Saved locally to device:\n${downloadResult.uri}`);
          }
        } catch (shareErr) {
          console.error(shareErr);
          Alert.alert('Download Complete', `Saved locally to device:\n${downloadResult.uri}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Download Failed', err.message || 'Could not download media file.');
    }
  };

  const handleSelectDocument = async () => {
    setIsMediaMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      const signatureData = await getCloudinarySignature();

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const controller = new AbortController();
      activeUploadsRef.current[tempId] = controller;

      const optimisticMsg: Message = {
        _id: tempId,
        tempId,
        chat: chatId!,
        sender: { _id: user!.id, displayName: user!.displayName, avatarUrl: user!.avatarUrl },
        status: 'sending',
        mediaUrl: asset.uri,
        mediaType: 'document',
        mediaSize: asset.size,
        text: asset.name,
        createdAt: new Date().toISOString(),
      };
      addOptimisticMessage(chatId!, optimisticMsg);

      try {
        const mediaUrl = await uploadToCloudinary(
          asset.uri,
          asset.mimeType || 'application/octet-stream',
          signatureData,
          (progress) => {
            setUploadProgressMap((prev) => ({ ...prev, [tempId]: progress }));
          },
          controller.signal
        );

        delete activeUploadsRef.current[tempId];
        await sendFinalizedMessage(chatId!, tempId, {
          url: mediaUrl,
          type: 'document',
          size: asset.size,
          text: asset.name,
        });
      } catch (uploadErr: any) {
        if (axios.isCancel(uploadErr)) {
          console.log('Document upload cancelled:', tempId);
        } else {
          console.error('Document upload failed:', uploadErr);
          removeMessage(chatId!, tempId);
          Alert.alert('Error', 'Failed to upload document.');
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', 'Failed to select document.');
    }
  };

  const handleSelectImage = async () => {
    setIsMediaMenuOpen(false);
    try {
      const assets = await pickMedia('image', true);
      if (!assets || assets.length === 0) return;

      const signatureData = await getCloudinarySignature();

      assets.forEach(async (asset) => {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const controller = new AbortController();
        activeUploadsRef.current[tempId] = controller;

        const optimisticMsg: Message = {
          _id: tempId,
          tempId,
          chat: chatId!,
          sender: { _id: user!.id, displayName: user!.displayName, avatarUrl: user!.avatarUrl },
          status: 'sending',
          mediaUrl: asset.uri,
          mediaType: 'image',
          mediaWidth: asset.width,
          mediaHeight: asset.height,
          mediaSize: asset.fileSize,
          createdAt: new Date().toISOString(),
        };
        addOptimisticMessage(chatId!, optimisticMsg);

        try {
          const compressedUri = await compressImage(asset.uri);

          const mediaUrl = await uploadToCloudinary(
            compressedUri,
            asset.mimeType || 'image/jpeg',
            signatureData,
            (progress) => {
              setUploadProgressMap((prev) => ({ ...prev, [tempId]: progress }));
            },
            controller.signal
          );

          await sendFinalizedMessage(chatId!, tempId, {
            url: mediaUrl,
            type: 'image',
            width: asset.width,
            height: asset.height,
            size: asset.fileSize,
          });

        } catch (error: any) {
          if (axios.isCancel(error) || error.name === 'AbortError') {
            console.log(`Upload ${tempId} was explicitly canceled.`);
          } else {
            console.error(`Upload ${tempId} failed:`, error);
            removeMessage(chatId!, tempId);
            Alert.alert('Upload Failed', 'Could not upload image.');
          }
        } finally {
          delete activeUploadsRef.current[tempId];
          setUploadProgressMap((prev) => {
            const updated = { ...prev };
            delete updated[tempId];
            return updated;
          });
        }
      });

      setReplyingTo(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSelectVideo = async () => {
    setIsMediaMenuOpen(false);
    try {
      const assets = await pickMedia('video', true);
      if (!assets || assets.length === 0) return;

      const signatureData = await getCloudinarySignature();

      assets.forEach(async (asset) => {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const controller = new AbortController();
        activeUploadsRef.current[tempId] = controller;

        const optimisticMsg: Message = {
          _id: tempId,
          tempId,
          chat: chatId!,
          sender: { _id: user!.id, displayName: user!.displayName, avatarUrl: user!.avatarUrl },
          status: 'sending',
          mediaUrl: asset.uri,
          mediaType: 'video',
          mediaWidth: asset.width,
          mediaHeight: asset.height,
          mediaSize: asset.fileSize,
          createdAt: new Date().toISOString(),
        };
        addOptimisticMessage(chatId!, optimisticMsg);

        try {
          const mediaUrl = await uploadToCloudinary(
            asset.uri,
            asset.mimeType || 'video/mp4',
            signatureData,
            (progress) => {
              setUploadProgressMap((prev) => ({ ...prev, [tempId]: progress }));
            },
            controller.signal
          );

          await sendFinalizedMessage(chatId!, tempId, {
            url: mediaUrl,
            type: 'video',
            width: asset.width,
            height: asset.height,
            size: asset.fileSize,
            duration: asset.duration ? asset.duration / 1000 : undefined,
          });

        } catch (error: any) {
          if (axios.isCancel(error) || error.name === 'AbortError') {
            console.log(`Upload ${tempId} was explicitly canceled.`);
          } else {
            console.error(`Upload ${tempId} failed:`, error);
            removeMessage(chatId!, tempId);
            Alert.alert('Upload Failed', 'Could not upload video.');
          }
        } finally {
          delete activeUploadsRef.current[tempId];
          setUploadProgressMap((prev) => {
            const updated = { ...prev };
            delete updated[tempId];
            return updated;
          });
        }
      });

      setReplyingTo(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleStartVoice = async () => {
    await startRecording();
  };

  const handleStopAndSendVoice = async () => {
    const localUri = await stopRecording();
    if (!localUri) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const controller = new AbortController();
    activeUploadsRef.current[tempId] = controller;

    const optimisticMsg: Message = {
      _id: tempId,
      tempId,
      chat: chatId!,
      sender: { _id: user!.id, displayName: user!.displayName, avatarUrl: user!.avatarUrl },
      status: 'sending',
      mediaUrl: localUri,
      mediaType: 'audio',
      createdAt: new Date().toISOString(),
    };
    addOptimisticMessage(chatId!, optimisticMsg);

    try {
      const signatureData = await getCloudinarySignature();

      const mediaUrl = await uploadToCloudinary(
        localUri,
        'audio/m4a',
        signatureData,
        (progress) => {
          setUploadProgressMap((prev) => ({ ...prev, [tempId]: progress }));
        },
        controller.signal
      );

      await sendFinalizedMessage(chatId!, tempId, {
        url: mediaUrl,
        type: 'audio',
      });

    } catch (error: any) {
      if (axios.isCancel(error) || error.name === 'AbortError') {
        console.log(`Voice note upload ${tempId} was explicitly canceled.`);
      } else {
        console.error(`Voice note upload ${tempId} failed:`, error);
        removeMessage(chatId!, tempId);
        Alert.alert('Upload Failed', 'Could not upload voice note.');
      }
    } finally {
      delete activeUploadsRef.current[tempId];
      setUploadProgressMap((prev) => {
        const updated = { ...prev };
        delete updated[tempId];
        return updated;
      });
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
          const onlyMedia = item.mediaUrl && !item.text && !item.isDeleted;
          return (
            <SwipeableRow item={item} isMe={isMe} onReply={() => setReplyingTo(item)}>
              <TouchableOpacity
                onLongPress={() => handleLongPressMessage(item)}
                activeOpacity={0.8}
                style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}
              >
                <View
                  style={[
                    styles.bubble,
                    isMe ? styles.myBubble : styles.otherBubble,
                    onlyMedia && styles.onlyMediaBubble,
                  ]}
                >
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

                  {item.mediaUrl && item.mediaType && !item.isDeleted && (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={async () => {
                        if (item.status !== 'sending') {
                          const fileExtension = item.mediaType === 'video' ? 'mp4' : item.mediaType === 'audio' ? 'm4a' : 'jpg';
                          const localPath = `${FileSystem.documentDirectory}media_${item._id}.${fileExtension}`;
                          const info = await FileSystem.getInfoAsync(localPath);
                          const activeUrl = info.exists ? localPath : item.mediaUrl;

                          setFullscreenMedia({
                            messageId: item._id,
                            url: activeUrl,
                            type: item.mediaType,
                          });
                        }
                      }}
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
                        progress={uploadProgressMap[item.tempId || '']}
                        onCancel={() => handleCancelParticularUpload(item.tempId!)}
                      />
                    </TouchableOpacity>
                  )}

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
          {isRecording ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingDotContainer}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>Recording Voice...</Text>
              </View>
              <View style={styles.recordingActions}>
                <TouchableOpacity onPress={handleStopAndSendVoice} style={styles.voiceSendButton}>
                  <Ionicons name="send" size={16} color="#070b13" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity onPress={handleAttachPress} style={styles.attachButton}>
                <Ionicons name="add" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TextInput
                placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                placeholderTextColor={COLORS.textSecondary}
                value={text}
                onChangeText={handleTextChange}
                style={styles.textInput}
                multiline
              />
              {text.trim() || editingMessage ? (
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!text.trim()}
                  style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
                >
                  <Text style={styles.sendButtonText}>{editingMessage ? 'Update' : 'Send'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleStartVoice} style={styles.micButton}>
                  <Ionicons name="mic" size={22} color={COLORS.accent} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Media Options Action Sheet Modal */}
      <Modal
        visible={isMediaMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMediaMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.mediaModalOverlay}
          activeOpacity={1}
          onPress={() => setIsMediaMenuOpen(false)}
        >
          <View style={styles.mediaMenuContainer}>
            <Text style={styles.mediaMenuTitle}>Share Media</Text>
            
            <TouchableOpacity style={styles.mediaMenuItem} onPress={handleSelectImage}>
              <Ionicons name="image-outline" size={22} color={COLORS.accent} style={styles.mediaMenuIcon} />
              <Text style={styles.mediaMenuItemText}>Photo Library</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mediaMenuItem} onPress={handleSelectVideo}>
              <Ionicons name="videocam-outline" size={22} color={COLORS.accent} style={styles.mediaMenuIcon} />
              <Text style={styles.mediaMenuItemText}>Video Library</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mediaMenuItem} onPress={handleSelectDocument}>
              <Ionicons name="document-outline" size={22} color={COLORS.accent} style={styles.mediaMenuIcon} />
              <Text style={styles.mediaMenuItemText}>Document</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.mediaMenuCancelButton} onPress={() => setIsMediaMenuOpen(false)}>
              <Text style={styles.mediaMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
                    setText(selectedMessage.text || '');
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

      {/* Fullscreen Media Viewer Modal */}
      <Modal
        visible={fullscreenMedia !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenMedia(null)}
      >
        <SafeAreaView style={styles.fullscreenMediaOverlay}>
          {/* Top Bar Controls */}
          <View style={styles.fullscreenMediaHeader}>
            <TouchableOpacity
              onPress={() => setFullscreenMedia(null)}
              style={styles.fullscreenHeaderButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <Text style={styles.fullscreenHeaderTitle}>
              {fullscreenMedia?.type === 'video' ? 'Video' : fullscreenMedia?.type === 'audio' ? 'Voice Note' : 'Photo'}
            </Text>

            {fullscreenMedia ? (
              <TouchableOpacity
                onPress={() => downloadMediaFile(fullscreenMedia.url, fullscreenMedia.type)}
                style={styles.fullscreenHeaderButton}
              >
                <Ionicons name="download" size={24} color={COLORS.accent} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>

          {/* Centered Viewer Content */}
          <View style={styles.fullscreenMediaContainer}>
            {fullscreenMedia?.type === 'image' && (
              <Image
                source={{ uri: fullscreenMedia.url }}
                style={{ width: '100%', height: '90%' }}
                resizeMode="contain"
              />
            )}

            {fullscreenMedia?.type === 'video' && (
              <View style={styles.fullscreenVideoWrapper}>
                <MediaMessage
                  messageId={fullscreenMedia.messageId}
                  mediaUrl={fullscreenMedia.url}
                  mediaType="video"
                />
              </View>
            )}

            {fullscreenMedia?.type === 'audio' && (
              <View style={styles.fullscreenAudioWrapper}>
                <MediaMessage
                  messageId={fullscreenMedia.messageId}
                  mediaUrl={fullscreenMedia.url}
                  mediaType="audio"
                />
              </View>
            )}
          </View>
        </SafeAreaView>
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
  // Media Messaging & Upload styles
  uploadProgressOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 11, 19, 0.95)',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  uploadProgressText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  recordingDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  mediaMenuContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mediaMenuTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  mediaMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#162235',
  },
  mediaMenuIcon: {
    marginRight: 16,
  },
  mediaMenuItemText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  mediaMenuCancelButton: {
    marginTop: 16,
    backgroundColor: '#162235',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  mediaMenuCancelText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelUploadButton: {
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  cancelUploadButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  onlyMediaBubble: {
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: 14,
  },
  metaRowOnlyMedia: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTextOnlyMedia: {
    fontSize: 9,
    color: '#E2E8F0',
  },
  statusTextOnlyMedia: {
    fontSize: 9,
    color: '#E2E8F0',
  },
  fullscreenMediaOverlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenMediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(7, 11, 19, 0.9)',
  },
  fullscreenHeaderButton: {
    padding: 6,
  },
  fullscreenHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  fullscreenMediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  fullscreenImageWrapper: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideoWrapper: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenAudioWrapper: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
});
