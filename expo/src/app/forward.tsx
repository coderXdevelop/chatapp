import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { COLORS, globalStyles } from '../styles/theme';

export default function ForwardScreen() {
  const router = useRouter();
  const { messageIds: rawMessageIds } = useLocalSearchParams<{ messageIds: string }>();
  const { chats, fetchChats, forwardMessages } = useChatStore();
  const { user } = useAuthStore();

  const messageIds = typeof rawMessageIds === 'string' ? rawMessageIds.split(',') : [];

  const [selectedChats, setSelectedChats] = useState<Record<string, boolean>>({});
  const [searchContact, setSearchContact] = useState('');
  const [customContacts, setCustomContacts] = useState<string[]>([]);
  const [selectedCustomContacts, setSelectedCustomContacts] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChats();
  }, []);

  const handleToggleChat = (chatId: string) => {
    setSelectedChats((prev) => ({
      ...prev,
      [chatId]: !prev[chatId],
    }));
  };

  const handleToggleCustomContact = (contact: string) => {
    setSelectedCustomContacts((prev) => ({
      ...prev,
      [contact]: !prev[contact],
    }));
  };

  const handleAddCustomContact = () => {
    const trimmed = searchContact.trim().toLowerCase();
    if (!trimmed) return;

    if (trimmed === user?.email?.toLowerCase() || trimmed === user?.connectId?.toLowerCase()) {
      Alert.alert('Invalid Contact', 'You cannot forward messages to yourself.');
      return;
    }

    if (customContacts.includes(trimmed)) {
      Alert.alert('Duplicate Contact', 'This contact is already in your selection list.');
      return;
    }

    setCustomContacts((prev) => [...prev, trimmed]);
    setSelectedCustomContacts((prev) => ({
      ...prev,
      [trimmed]: true,
    }));
    setSearchContact('');
  };

  const handleRemoveCustomContact = (contact: string) => {
    setCustomContacts((prev) => prev.filter((c) => c !== contact));
    setSelectedCustomContacts((prev) => {
      const copy = { ...prev };
      delete copy[contact];
      return copy;
    });
  };

  const handleForward = async () => {
    const chatIds = Object.keys(selectedChats).filter((id) => selectedChats[id]);
    const contacts = Object.keys(selectedCustomContacts).filter((c) => selectedCustomContacts[c]);

    if (chatIds.length === 0 && contacts.length === 0) {
      Alert.alert('No Recipients', 'Please select at least one recipient.');
      return;
    }

    setLoading(true);
    try {
      const success = await forwardMessages(messageIds, chatIds, contacts);
      if (success) {
        Alert.alert('Success', 'Message forwarded successfully!', [
          {
            text: 'OK',
            onPress: () => {
              router.dismissAll();
              router.replace('/home');
            },
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to forward messages.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const totalSelectedCount =
    Object.values(selectedChats).filter(Boolean).length +
    Object.values(selectedCustomContacts).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forward to...</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* Section: Add target by ID/Email */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Recipient by User ID or Email</Text>
            <View style={styles.searchRow}>
              <TextInput
                placeholder="Enter unique ID or email address..."
                placeholderTextColor={COLORS.textSecondary}
                value={searchContact}
                onChangeText={setSearchContact}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleAddCustomContact}
                style={[styles.addButton, !searchContact.trim() && styles.addButtonDisabled]}
                disabled={!searchContact.trim()}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* List of Custom Contacts Added */}
            {customContacts.length > 0 && (
              <View style={styles.customContactsList}>
                {customContacts.map((contact) => (
                  <View key={contact} style={styles.customContactChip}>
                    <TouchableOpacity
                      onPress={() => handleToggleCustomContact(contact)}
                      style={styles.chipToggle}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selectedCustomContacts[contact] && styles.checkboxChecked,
                        ]}
                      >
                        {selectedCustomContacts[contact] && <Text style={styles.checkboxCheckmark}>✓</Text>}
                      </View>
                      <Text style={styles.chipText} numberOfLines={1}>
                        {contact}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveCustomContact(contact)}
                      style={styles.chipDeleteButton}
                    >
                      <Text style={styles.chipDeleteText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Section: Recent Chats */}
          <View style={[styles.section, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>Recent Chats</Text>
            {chats.length === 0 ? (
              <Text style={styles.emptyText}>No recent chats found.</Text>
            ) : (
              chats.map((item) => {
                const partner = item.participants.find((p) => p._id !== user?.id);
                const isSelected = !!selectedChats[item._id];
                const initial = (partner?.displayName || 'C').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    key={item._id}
                    style={[styles.chatRow, isSelected && styles.chatRowSelected]}
                    onPress={() => handleToggleChat(item._id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        isSelected && styles.checkboxChecked,
                        { marginRight: 14 },
                      ]}
                    >
                      {isSelected && <Text style={styles.checkboxCheckmark}>✓</Text>}
                    </View>

                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>

                    <View style={styles.chatInfo}>
                      <Text style={styles.chatName} numberOfLines={1}>
                        {partner?.displayName || 'ChatConnect User'}
                      </Text>
                      <Text style={styles.chatSubtext} numberOfLines={1}>
                        {partner?.connectId ? `@${partner.connectId}` : partner?.email}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Send Action Button */}
      {totalSelectedCount > 0 && (
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.forwardButton}
            onPress={handleForward}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.primaryText} size="small" />
            ) : (
              <Text style={styles.forwardButtonText}>
                Forward to {totalSelectedCount} recipient{totalSelectedCount > 1 ? 's' : ''} 🚀
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  headerRightPlaceholder: {
    width: 60,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#03050a',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: COLORS.primaryText,
    fontWeight: '800',
    fontSize: 15,
  },
  customContactsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customContactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#03050a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    maxWidth: 240,
  },
  chipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
    flexShrink: 1,
  },
  chipDeleteButton: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDeleteText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  chatRowSelected: {
    borderColor: COLORS.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxCheckmark: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: '900',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  chatSubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  footerContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  forwardButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardButtonText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
});
