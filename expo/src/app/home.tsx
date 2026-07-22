import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { api } from '../services/api';
import { COLORS, globalStyles } from '../styles/theme';
import ProfileScreen from './profile';

interface SearchUser {
  _id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  status: string;
  connectId?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { chats, fetchChats, connectSocket, socketConnected } = useChatStore();

  const [activeTab, setActiveTab] = useState<'HOME' | 'PROFILE' | 'HELP'>('HOME');

  // Modal states for adding contact
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactSearchInput, setContactSearchInput] = useState('');
  const [loadingContact, setLoadingContact] = useState(false);

  useEffect(() => {
    // Ensure socket connects and chats are fetched on mount
    connectSocket();
    fetchChats();

    // Fetch chats periodically or when returning to HOME tab
    const interval = setInterval(() => {
      if (activeTab === 'HOME') {
        fetchChats();
      }
    }, 15000); // 15 seconds poll fallback

    return () => clearInterval(interval);
  }, [activeTab]);

  const handleAddContact = async () => {
    if (!contactSearchInput.trim()) return;
    setLoadingContact(false);
    setLoadingContact(true);

    try {
      // Calls createChat route using search input
      const res = await api.post('/api/chats', { searchContact: contactSearchInput.trim().toLowerCase() });
      const newChat = res.data.chat;

      setIsAddModalOpen(false);
      setContactSearchInput('');

      // Refresh chats lists and navigate to chat room
      await fetchChats();
      router.push(`/chat/${newChat._id}` as any);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || 'Failed to establish contact.';
      Alert.alert('Contact Error', errMsg);
    } finally {
      setLoadingContact(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.contentContainer}>
        {activeTab === 'HOME' && (
          <View style={styles.tabContent}>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Chats</Text>
                <Text style={styles.connectionStatus}>
                  {socketConnected ? '🟢 Connected' : '🔴 Connecting...'}
                </Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={() => setIsAddModalOpen(true)}>
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* List of active chat threads */}
            <FlatList
              data={chats}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>💬</Text>
                  <Text style={styles.emptyText}>No chat threads yet.</Text>
                  <Text style={styles.emptySubtext}>
                    Tap the "+" button in the top right to start a secure conversation by typing a User ID or Email.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const partner = item.participants.find((p) => p._id !== user?.id);
                const initial = (partner?.displayName || 'C').charAt(0).toUpperCase();
                const unreadCount = item.unreadCounts?.[user?.id || ''] || 0;

                return (
                  <TouchableOpacity
                    style={styles.chatRow}
                    onPress={() => router.push(`/chat/${item._id}` as any)}
                    activeOpacity={0.7}
                  >
                    {partner?.avatarUrl ? (
                      <Image source={{ uri: partner.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>{initial}</Text>
                      </View>
                    )}
                    <View style={styles.chatInfo}>
                      <View style={styles.chatHeaderRow}>
                        <Text style={styles.chatName} numberOfLines={1}>
                          {partner?.displayName || 'ChatConnect User'}
                        </Text>
                        {item.lastMessage && (
                          <Text style={styles.chatTime}>
                            {new Date(item.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>
                      <View style={styles.chatBodyRow}>
                        <Text style={styles.lastMessage} numberOfLines={1}>
                          {item.lastMessage ? item.lastMessage.text : `Tap to chat with ${partner?.displayName}`}
                        </Text>
                        {unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadCountText}>{unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {activeTab === 'PROFILE' && <ProfileScreen />}

        {activeTab === 'HELP' && (
          <ScrollView contentContainerStyle={styles.helpContainer}>
            <Text style={styles.helpTitle}>Help & FAQ</Text>
            <Text style={styles.helpSubtitle}>Get help with ChatConnect core messaging.</Text>

            <View style={styles.helpCard}>
              <Text style={styles.helpCardTitle}>💬 Direct Messaging</Text>
              <Text style={styles.helpCardText}>
                We prioritize user privacy. There is no public list of users. To start a chat, press the "+" button in the top right of your chats tab and input your contact's registered email or their unique User ID.
              </Text>
            </View>

            <View style={styles.helpCard}>
              <Text style={styles.helpCardTitle}>🆔 Sharing My User ID</Text>
              <Text style={styles.helpCardText}>
                Navigate to the Profile tab. Your unique User ID is listed under your Personal Information section. Tap to view and share it with friends so they can add you directly.
              </Text>
            </View>

            <View style={styles.helpCard}>
              <Text style={styles.helpCardTitle}>🔌 Real-Time Presence</Text>
              <Text style={styles.helpCardText}>
                We connect you securely over WebSockets. Check the status indicator under the "Chats" title. If offline, the client continues to retry while transparently using fallback HTTP protocols.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('HOME')}
          style={[styles.navItem, activeTab === 'HOME' && styles.navItemActive]}
        >
          <Text style={styles.navIcon}>💬</Text>
          <Text style={[styles.navText, activeTab === 'HOME' && styles.navTextActive]}>Chats</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('PROFILE')}
          style={[styles.navItem, activeTab === 'PROFILE' && styles.navItemActive]}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={[styles.navText, activeTab === 'PROFILE' && styles.navTextActive]}>Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('HELP')}
          style={[styles.navItem, activeTab === 'HELP' && styles.navItemActive]}
        >
          <Text style={styles.navIcon}>❓</Text>
          <Text style={[styles.navText, activeTab === 'HELP' && styles.navTextActive]}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Add Contact Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Contact</Text>
            <Text style={styles.modalSubtitle}>
              Type your contact's registered email address or unique User ID handle (e.g. "nanda" or "user_4910").
            </Text>

            <View style={globalStyles.inputGroup}>
              <View style={globalStyles.inputWrapper}>
                <TextInput
                  style={globalStyles.input}
                  placeholder="User ID or Email"
                  placeholderTextColor={COLORS.textSecondary}
                  value={contactSearchInput}
                  onChangeText={setContactSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => {
                  setIsAddModalOpen(false);
                  setContactSearchInput('');
                }}
                disabled={loadingContact}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalButton, loadingContact && styles.disabledModalButton]}
                onPress={handleAddContact}
                disabled={loadingContact || !contactSearchInput.trim()}
              >
                {loadingContact ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <Text style={styles.saveModalText}>Start Chat</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  connectionStatus: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.primaryText,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  listContainer: {
    paddingBottom: 24,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#070b13',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  chatTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  chatBodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: COLORS.primaryText,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  navBar: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    opacity: 0.5,
  },
  navItemActive: {
    opacity: 1,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  navTextActive: {
    color: COLORS.primary,
  },
  // Help View Styles
  helpContainer: {
    padding: 24,
  },
  helpTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  helpSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  helpCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  helpCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  helpCardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  // Add Contact Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  cancelModalText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  saveModalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledModalButton: {
    opacity: 0.6,
  },
  saveModalText: {
    color: COLORS.primaryText,
    fontWeight: '700',
    fontSize: 15,
  },
});
