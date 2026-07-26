import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useChatStore, Message } from '../store/chatStore';
import { COLORS } from '../styles/theme';

export default function StarredMessagesScreen() {
  const router = useRouter();
  const { starredMessages, fetchStarredMessages } = useChatStore();

  useEffect(() => {
    fetchStarredMessages();
  }, []);

  const handleOpenChat = (chatId: string) => {
    router.push(`/chat/${chatId}` as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⭐ Starred Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* List */}
      <FlatList
        data={starredMessages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>No Starred Messages</Text>
            <Text style={styles.emptySubtitle}>
              Long-press any message in a chat and select "Star Message" to save it here for quick access.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const senderName = item.sender?.displayName || 'Someone';
          const chatName = (item.chat as any)?.name || 'Chat';
          const isMedia = !!item.mediaUrl;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleOpenChat((item.chat as any)?._id || item.chat)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.senderName}>{senderName}</Text>
                <Text style={styles.timeText}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {item.text ? (
                <Text style={styles.messageText} numberOfLines={3}>
                  {item.text}
                </Text>
              ) : null}

              {isMedia ? (
                <View style={styles.mediaBadge}>
                  <Text style={styles.mediaBadgeText}>
                    {item.mediaType === 'image' && '📷 Photo'}
                    {item.mediaType === 'video' && '🎥 Video'}
                    {item.mediaType === 'audio' && '🎵 Voice Note'}
                    {item.mediaType === 'document' && '📄 Document'}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.chatSubtext}>In: {chatName}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#030712',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    padding: 8,
  },
  backText: {
    color: '#F59E0B',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  mediaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  mediaBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  chatSubtext: {
    color: '#64748B',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
