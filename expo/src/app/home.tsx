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
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { api } from '../services/api';
import { COLORS, globalStyles } from '../styles/theme';
import ProfileScreen from './profile';
import { ChatListSkeleton } from '../components/SkeletonLoaders';

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
  const { chats, fetchChats, connectSocket, socketConnected, activeStatuses, fetchStatusFeed } = useChatStore();

  const [activeTab, setActiveTab] = useState<'HOME' | 'PROFILE' | 'HELP'>('HOME');
  const [filterTab, setFilterTab] = useState<'ALL' | 'CHATS' | 'GROUPS' | 'FAVOURITES'>('ALL');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const isSelectionMode = selectedChatIds.length > 0;

  // Modal states for adding contact
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactSearchInput, setContactSearchInput] = useState('');
  const [loadingContact, setLoadingContact] = useState(false);
  const [initialLoading, setInitialLoading] = useState(chats.length === 0);

  useEffect(() => {
    connectSocket();
    fetchChats().finally(() => setInitialLoading(false));
    fetchStatusFeed();

    const interval = setInterval(() => {
      if (activeTab === 'HOME') {
        fetchChats();
        fetchStatusFeed();
      }
    }, 15000);

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

  const filteredChats = chats.filter((item) => {
    if (globalSearchQuery.trim()) {
      const q = globalSearchQuery.trim().toLowerCase();
      const partner = item.participants.find((p) => p._id !== user?.id);
      const nameMatch = (item.isGroup ? item.name : partner?.displayName)?.toLowerCase().includes(q);
      const emailMatch = partner?.email?.toLowerCase().includes(q);
      const idMatch = partner?.connectId?.toLowerCase().includes(q);
      const msgMatch = item.lastMessage?.text?.toLowerCase().includes(q);

      if (!nameMatch && !emailMatch && !idMatch && !msgMatch) {
        return false;
      }
    }

    if (filterTab === 'CHATS') return !item.isGroup;
    if (filterTab === 'GROUPS') return !!item.isGroup;
    if (filterTab === 'FAVOURITES') return !!item.isFavourite;
    return true;
  });

  const toggleSelectChat = (chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSelectAll = () => {
    if (selectedChatIds.length === filteredChats.length) {
      setSelectedChatIds([]);
    } else {
      setSelectedChatIds(filteredChats.map((c) => c._id));
    }
  };

  const handleToggleFavoriteSelected = async () => {
    if (selectedChatIds.length === 0) return;
    const { toggleFavoriteChat } = useChatStore.getState();
    for (const chatId of selectedChatIds) {
      await toggleFavoriteChat(chatId);
    }
    setSelectedChatIds([]);
  };

  const handleDeleteSelected = () => {
    if (selectedChatIds.length === 0) return;
    Alert.alert(
      'Permanently Delete Chat(s)',
      `Are you sure you want to permanently delete ${selectedChatIds.length} selected conversation(s)? This will clear all messages and remove the chat from your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { deleteChats } = useChatStore.getState();
            const success = await deleteChats(selectedChatIds);
            if (success) {
              setSelectedChatIds([]);
            } else {
              Alert.alert('Error', 'Failed to delete selected chats.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.contentContainer}>
        {activeTab === 'HOME' && (
          <View style={styles.tabContent}>
            {/* Dynamic Header: Selection vs Normal */}
            {isSelectionMode ? (
              <View style={styles.selectionHeader}>
                <TouchableOpacity
                  style={styles.selectionCloseBtn}
                  onPress={() => setSelectedChatIds([])}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.selectionCloseText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.selectionTitle}>{selectedChatIds.length} Selected</Text>
                <View style={styles.selectionActions}>
                  <TouchableOpacity style={styles.selectionTextBtn} onPress={handleSelectAll}>
                    <Text style={styles.selectionTextBtnLabel}>
                      {selectedChatIds.length === filteredChats.length ? 'Deselect' : 'All'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.selectionIconBtn} onPress={handleToggleFavoriteSelected}>
                    <Text style={styles.actionIconText}>⭐</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.selectionIconBtn, styles.deleteIconBtn]} onPress={handleDeleteSelected}>
                    <Text style={styles.actionIconText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={require('../../assets/images/Linkup.png')}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      marginRight: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(204, 255, 0, 0.25)',
                    }}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.headerTitle}>LinkUP</Text>
                    <Text style={styles.connectionStatus}>
                      {socketConnected ? '🟢 Connected' : '🔴 Connecting...'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Global Search Bar */}
            <View style={{ marginBottom: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0F172A',
                borderRadius: 14,
                paddingHorizontal: 14,
                height: 44,
                borderWidth: 1,
                borderColor: '#1E293B',
              }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
                <TextInput
                  style={{ flex: 1, color: '#F8FAFC', fontSize: 14 }}
                  placeholder="Search chats, contacts, or messages..."
                  placeholderTextColor="#64748B"
                  value={globalSearchQuery}
                  onChangeText={setGlobalSearchQuery}
                />
                {globalSearchQuery ? (
                  <TouchableOpacity onPress={() => setGlobalSearchQuery('')}>
                    <Text style={{ color: '#64748B', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* Status / Stories Bar */}
            <View style={{ marginBottom: 18 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {/* My Status Item */}
                <TouchableOpacity
                  style={{ alignItems: 'center', width: 64 }}
                  onPress={() => {
                    const myStory = activeStatuses.find((s) => s.user?._id === user?.id);
                    if (myStory) {
                      router.push(`/status/view?userId=${user?.id}` as any);
                    } else {
                      router.push('/status/create' as any);
                    }
                  }}
                >
                  <View style={{ position: 'relative', width: 54, height: 54 }}>
                    <Image
                      source={{ uri: user?.avatarUrl || 'https://via.placeholder.com/150' }}
                      style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#F59E0B' }}
                    />
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#F59E0B',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: '#030712',
                      }}
                      onPress={() => router.push('/status/create' as any)}
                    >
                      <Text style={{ color: '#0F172A', fontSize: 12, fontWeight: 'bold' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: '#F8FAFC', fontSize: 11, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>
                    My Status
                  </Text>
                </TouchableOpacity>

                {/* Contact Stories */}
                {activeStatuses
                  .filter((group) => group.user?._id !== user?.id)
                  .map((group) => (
                    <TouchableOpacity
                      key={group.user._id}
                      style={{ alignItems: 'center', width: 64 }}
                      onPress={() => router.push(`/status/view?userId=${group.user._id}` as any)}
                    >
                      <View style={{ width: 54, height: 54, borderRadius: 27, padding: 2, borderWidth: 2, borderColor: '#F59E0B' }}>
                        <Image
                          source={{ uri: group.user?.avatarUrl || 'https://via.placeholder.com/150' }}
                          style={{ width: '100%', height: '100%', borderRadius: 25 }}
                        />
                      </View>
                      <Text style={{ color: '#F8FAFC', fontSize: 11, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>
                        {group.user?.displayName || 'Contact'}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>

            {/* Top Filter Chips */}
            <View style={styles.filterContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                <TouchableOpacity
                  style={[styles.filterChip, filterTab === 'ALL' && styles.filterChipActive]}
                  onPress={() => setFilterTab('ALL')}
                >
                  <Text style={[styles.filterText, filterTab === 'ALL' && styles.filterTextActive]}>
                    All ({chats.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, filterTab === 'CHATS' && styles.filterChipActive]}
                  onPress={() => setFilterTab('CHATS')}
                >
                  <Text style={[styles.filterText, filterTab === 'CHATS' && styles.filterTextActive]}>
                    Chats ({chats.filter((c) => !c.isGroup).length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, filterTab === 'GROUPS' && styles.filterChipActive]}
                  onPress={() => setFilterTab('GROUPS')}
                >
                  <Text style={[styles.filterText, filterTab === 'GROUPS' && styles.filterTextActive]}>
                    Groups ({chats.filter((c) => c.isGroup).length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, filterTab === 'FAVOURITES' && styles.filterChipActive]}
                  onPress={() => setFilterTab('FAVOURITES')}
                >
                  <Text style={[styles.filterText, filterTab === 'FAVOURITES' && styles.filterTextActive]}>
                    ⭐ Favourites ({chats.filter((c) => c.isFavourite).length})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* List of active chat threads */}
            {initialLoading && chats.length === 0 ? (
              <ChatListSkeleton />
            ) : (
              <FlatList
                data={filteredChats}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>💬</Text>
                    <Text style={styles.emptyText}>
                      {filterTab === 'FAVOURITES'
                        ? 'No favourite chats yet.'
                        : filterTab === 'GROUPS'
                        ? 'No group chats yet.'
                        : 'No chat threads found.'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {filterTab === 'FAVOURITES'
                        ? 'Long-press any chat or tap the ⭐ button to add it to your favourites.'
                        : 'Tap the "+" button in the bottom right to start a secure conversation or create a group.'}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const partner = item.participants.find((p) => p._id !== user?.id);
                  const displayName = item.isGroup ? item.name : (partner?.displayName || 'LinkUP User');
                  const avatarUrl = item.isGroup ? item.avatarUrl : partner?.avatarUrl;
                  const initial = (displayName || 'C').charAt(0).toUpperCase();
                  const unreadCount = item.unreadCounts?.[user?.id || ''] || 0;
                  const isSelected = selectedChatIds.includes(item._id);

                  return (
                    <TouchableOpacity
                      style={[styles.chatRow, isSelected && styles.chatRowSelected]}
                      onPress={() => {
                        if (isSelectionMode) {
                          toggleSelectChat(item._id);
                        } else {
                          router.push(`/chat/${item._id}` as any);
                        }
                      }}
                      onLongPress={() => {
                        if (!isSelectionMode) {
                          setSelectedChatIds([item._id]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {isSelectionMode && (
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      )}

                      <View style={styles.avatarContainer}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{initial}</Text>
                          </View>
                        )}
                        {!item.isGroup && partner?.isOnline && <View style={styles.onlineBadge} />}
                      </View>
                      <View style={styles.chatInfo}>
                        <View style={styles.chatHeaderRow}>
                          <Text style={styles.chatName} numberOfLines={1}>
                            {displayName}
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
                            {item.lastMessage
                              ? item.lastMessage.text
                              : item.isGroup
                              ? 'Tap to open group chat'
                              : `Tap to chat with ${partner?.displayName}`}
                          </Text>
                          <View style={styles.rowRightBadges}>
                            {item.isFavourite && <Text style={styles.favBadgeText}>⭐</Text>}
                            {unreadCount > 0 && (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadCountText}>{unreadCount}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}

        {activeTab === 'PROFILE' && <ProfileScreen />}

        {activeTab === 'HELP' && (
          <ScrollView contentContainerStyle={styles.helpContainer}>
            <Text style={styles.helpTitle}>Help & FAQ</Text>
            <Text style={styles.helpSubtitle}>Get help with LinkUP core messaging.</Text>

            <View style={styles.helpCard}>
              <Text style={styles.helpCardTitle}>💬 Direct Messaging & Groups</Text>
              <Text style={styles.helpCardText}>
                We prioritize user privacy. Press the "+" button in the bottom right to start a secure 1:1 conversation or create a group chat.
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

      {/* Floating Action Button (FAB) for starting conversation options */}
      {activeTab === 'HOME' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Alert.alert(
              'New Conversation',
              'Start a secure conversation or create a group:',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'New Secure DM', onPress: () => setIsAddModalOpen(true) },
                { text: 'Create Group Chat', onPress: () => router.push('/chat/group/create' as any) },
              ],
              { cancelable: true }
            );
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}


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
  fab: {
    position: 'absolute',
    bottom: 84, // 64 (navBar height) + 20
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999,
  },
  fabText: {
    color: COLORS.primaryText,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 30,
    marginTop: -2,
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
  avatarContainer: {
    position: 'relative',
    width: 48,
    height: 48,
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
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CCFF00', // COLORS.primary (Neon lime)
    borderWidth: 2,
    borderColor: COLORS.cardBackground,
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
  // Selection Header & Actions
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  selectionCloseBtn: {
    padding: 6,
    marginRight: 8,
  },
  selectionCloseText: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  selectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionTextBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  selectionTextBtnLabel: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  selectionIconBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  actionIconText: {
    fontSize: 16,
  },
  // Filter Tabs Bar
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.primaryText,
    fontWeight: '800',
  },
  // Selection Row Checkbox & Badges
  chatRowSelected: {
    backgroundColor: 'rgba(204, 255, 0, 0.08)',
    borderColor: COLORS.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.primaryText,
    fontSize: 13,
    fontWeight: '900',
  },
  rowRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  favBadgeText: {
    fontSize: 14,
  },
});
