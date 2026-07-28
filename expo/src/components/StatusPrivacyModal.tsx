import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useChatStore, Chat } from '../store/chatStore';

interface StatusPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const StatusPrivacyModal: React.FC<StatusPrivacyModalProps> = ({ visible, onClose }) => {
  const {
    chats,
    statusPrivacy,
    fetchStatusPrivacy,
    updateStatusPrivacy,
  } = useChatStore();

  const [privacyType, setPrivacyType] = useState<'contacts' | 'except' | 'only'>('contacts');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Derive unique contacts from user chats
  const contactsList = React.useMemo(() => {
    const map = new Map<string, any>();
    chats.forEach((c) => {
      if (!c.isGroup) {
        c.participants.forEach((p) => {
          if (p._id) {
            map.set(p._id, p);
          }
        });
      }
    });
    return Array.from(map.values());
  }, [chats]);

  useEffect(() => {
    if (visible) {
      fetchStatusPrivacy();
    }
  }, [visible]);

  useEffect(() => {
    if (statusPrivacy) {
      setPrivacyType(statusPrivacy.type || 'contacts');
      if (statusPrivacy.type === 'except') {
        setSelectedUserIds((statusPrivacy.excludedUsers || []).map((u: any) => u._id || u));
      } else if (statusPrivacy.type === 'only') {
        setSelectedUserIds((statusPrivacy.includedUsers || []).map((u: any) => u._id || u));
      } else {
        setSelectedUserIds([]);
      }
    }
  }, [statusPrivacy]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    let excludedUsers: string[] = [];
    let includedUsers: string[] = [];

    if (privacyType === 'except') {
      excludedUsers = selectedUserIds;
    } else if (privacyType === 'only') {
      includedUsers = selectedUserIds;
    }

    const success = await updateStatusPrivacy({
      type: privacyType,
      excludedUsers,
      includedUsers,
    });

    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Status Privacy</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subTitle}>Who can see my status updates?</Text>

          {/* Privacy Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.optionRow, privacyType === 'contacts' && styles.optionRowSelected]}
              onPress={() => {
                setPrivacyType('contacts');
                setSelectedUserIds([]);
              }}
            >
              <View style={styles.radioCircle}>
                {privacyType === 'contacts' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>My Contacts</Text>
                <Text style={styles.optionDesc}>Share with all contacts in your chats</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionRow, privacyType === 'except' && styles.optionRowSelected]}
              onPress={() => {
                setPrivacyType('except');
              }}
            >
              <View style={styles.radioCircle}>
                {privacyType === 'except' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>My Contacts Except...</Text>
                <Text style={styles.optionDesc}>Hide status updates from selected contacts</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionRow, privacyType === 'only' && styles.optionRowSelected]}
              onPress={() => {
                setPrivacyType('only');
              }}
            >
              <View style={styles.radioCircle}>
                {privacyType === 'only' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>Only Share With...</Text>
                <Text style={styles.optionDesc}>Share only with selected contacts</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Contacts Selector List for Except / Only */}
          {privacyType !== 'contacts' && (
            <View style={styles.contactsSection}>
              <Text style={styles.contactsHeaderTitle}>
                {privacyType === 'except'
                  ? `Select contacts to exclude (${selectedUserIds.length})`
                  : `Select contacts to share with (${selectedUserIds.length})`}
              </Text>
              <FlatList
                data={contactsList}
                keyExtractor={(item) => item._id}
                style={styles.contactsList}
                renderItem={({ item }) => {
                  const isSelected = selectedUserIds.includes(item._id);
                  return (
                    <TouchableOpacity
                      style={styles.contactRow}
                      onPress={() => toggleUserSelection(item._id)}
                    >
                      <Image
                        source={{ uri: item.avatarUrl || 'https://via.placeholder.com/150' }}
                        style={styles.contactAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName}>{item.displayName}</Text>
                        <Text style={styles.contactEmail}>{item.email}</Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {/* Footer Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.saveBtnText}>Save Privacy Settings</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subTitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  optionRowSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  optionTextWrapper: {
    flex: 1,
  },
  optionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  optionDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  contactsSection: {
    maxHeight: 220,
    marginBottom: 16,
  },
  contactsHeaderTitle: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  contactsList: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  contactName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  contactEmail: {
    color: '#94A3B8',
    fontSize: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  checkmark: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 15,
  },
});
