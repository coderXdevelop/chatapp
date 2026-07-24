import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { COLORS, globalStyles } from '../../../styles/theme';
import { pickMedia, getCloudinarySignature, compressImage, uploadToCloudinary } from '../../../services/mediaUpload';

export default function GroupSettingsScreen() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuthStore();
  const {
    chats,
    updateGroupSettings,
    addGroupMembers,
    removeGroupMember,
    leaveGroup,
    promoteGroupAdmin,
  } = useChatStore();

  const chat = chats.find((c) => c._id === chatId);

  if (!chat) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Group chat not found.</Text>
          <TouchableOpacity style={globalStyles.button} onPress={() => router.back()}>
            <Text style={globalStyles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = chat.admins?.includes(user?.id || '');
  const isCreator = chat.creator === user?.id;

  const [groupName, setGroupName] = useState(chat.name || '');
  const [editingName, setEditingName] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedNewUserIds, setSelectedNewUserIds] = useState<string[]>([]);

  // Find contacts not in this group
  const existingParticipantIds = chat.participants.map((p) => p._id);
  const addableContacts = Array.from(
    new Map(
      chats
        .filter((c) => !c.isGroup)
        .flatMap((c) => c.participants)
        .filter((p) => p._id !== user?.id && !existingParticipantIds.includes(p._id))
        .map((p) => [p._id, p])
    ).values()
  );

  const handleUpdateName = async () => {
    if (!groupName.trim() || groupName.trim() === chat.name) {
      setEditingName(false);
      return;
    }
    setUpdating(true);
    try {
      await updateGroupSettings(chat._id, groupName.trim());
      setEditingName(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update name.');
    } finally {
      setUpdating(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!isAdmin) return;
    try {
      const assets = await pickMedia('image');
      if (!assets || assets.length === 0) return;

      setUploadingAvatar(true);
      const localUri = assets[0].uri;
      const compressedUri = await compressImage(localUri);

      // Upload to Cloudinary
      const sigData = await getCloudinarySignature();
      const mime = assets[0].mimeType || 'image/jpeg';
      const uploadedUrl = await uploadToCloudinary(
        compressedUri,
        mime,
        sigData,
        () => {}
      );

      // Extract public ID
      const parts = uploadedUrl.split('/');
      const filename = parts.pop() || '';
      const publicId = filename.split('.')[0] || '';

      await updateGroupSettings(chat._id, undefined, uploadedUrl, publicId);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleMemberOptions = (memberId: string, memberName: string) => {
    if (!isAdmin) return;
    if (memberId === user?.id) return; // Cannot manage yourself

    const memberIsAdmin = chat.admins?.includes(memberId);
    const memberIsCreator = chat.creator === memberId;

    const options = [];

    // Promote/Demote Admin actions
    if (!memberIsCreator) {
      options.push({
        text: memberIsAdmin ? 'Dismiss as Admin' : 'Make Group Admin',
        onPress: async () => {
          try {
            await promoteGroupAdmin(chat._id, memberId, memberIsAdmin ? 'demote' : 'promote');
          } catch (e: any) {
            Alert.alert('Action Failed', e.message);
          }
        },
      });
    }

    // Remove member actions (creator cannot be removed, only admins can kick)
    if (!memberIsCreator) {
      options.push({
        text: 'Remove from Group',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert(
            'Remove Member',
            `Are you sure you want to remove ${memberName} from the group?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await removeGroupMember(chat._id, memberId);
                  } catch (e: any) {
                    Alert.alert('Action Failed', e.message);
                  }
                },
              },
            ]
          );
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert('Manage Member', `Choose action for ${memberName}:`, options, { cancelable: true });
  };

  const handleAddMembersSubmit = async () => {
    if (selectedNewUserIds.length === 0) return;
    try {
      await addGroupMembers(chat._id, selectedNewUserIds);
      setIsAddMemberModalOpen(false);
      setSelectedNewUserIds([]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add members.');
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const success = await leaveGroup(chat._id);
            if (success) {
              // Redirect to home chat listings list
              router.dismissAll();
              router.replace('/home' as any);
            }
          },
        },
      ]
    );
  };

  const toggleSelectNewMember = (userId: string) => {
    if (selectedNewUserIds.includes(userId)) {
      setSelectedNewUserIds(selectedNewUserIds.filter((id) => id !== userId));
    } else {
      if (chat.participants.length + selectedNewUserIds.length >= 150) {
        Alert.alert('Group Limit', 'A group chat cannot exceed 150 members.');
        return;
      }
      setSelectedNewUserIds([...selectedNewUserIds, userId]);
    }
  };

  const initial = (chat.name || 'G').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Chat</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={chat.participants}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <View style={styles.infoSection}>
            {/* Avatar picker/viewer */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickAvatar}
              disabled={!isAdmin || uploadingAvatar}
            >
              {chat.avatarUrl ? (
                <Image source={{ uri: chat.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
              {isAdmin && (
                <View style={styles.avatarEditBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.avatarEditIcon}>✏️</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* Group Name editable input */}
            <View style={styles.nameContainer}>
              {editingName ? (
                <View style={styles.editNameRow}>
                  <View style={[globalStyles.inputWrapper, { flex: 1 }]}>
                    <TextInput
                      style={globalStyles.input}
                      value={groupName}
                      onChangeText={setGroupName}
                      maxLength={50}
                      autoFocus
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.saveNameButton, updating && styles.disabledButton]}
                    onPress={handleUpdateName}
                    disabled={updating}
                  >
                    <Text style={styles.saveNameText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.displayNameRow}>
                  <Text style={styles.displayName}>{chat.name}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => setEditingName(true)}>
                      <Text style={styles.editIcon}>✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            <Text style={styles.participantHeaderTitle}>
              Members ({chat.participants.length})
            </Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.addMemberRow}
                onPress={() => setIsAddMemberModalOpen(true)}
              >
                <View style={styles.addIconCircle}>
                  <Text style={styles.addIconText}>+</Text>
                </View>
                <Text style={styles.addMemberLabel}>Add Participant</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isUserCreator = chat.creator === item._id;
          const isUserAdmin = chat.admins?.includes(item._id);
          const userInitial = (item.displayName || 'U').charAt(0).toUpperCase();

          return (
            <TouchableOpacity
              style={styles.memberRow}
              onPress={() => handleMemberOptions(item._id, item.displayName)}
              disabled={!isAdmin || item._id === user?.id}
              activeOpacity={0.7}
            >
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.memberAvatar} />
              ) : (
                <View style={styles.memberAvatarPlaceholder}>
                  <Text style={styles.memberAvatarText}>{userInitial}</Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {item.displayName} {item._id === user?.id && '(You)'}
                </Text>
                <Text style={styles.memberStatus} numberOfLines={1}>
                  {item.status}
                </Text>
              </View>

              <View style={styles.badgeRow}>
                {isUserCreator && (
                  <View style={[styles.badge, styles.creatorBadge]}>
                    <Text style={styles.badgeText}>Owner</Text>
                  </View>
                )}
                {isUserAdmin && !isUserCreator && (
                  <View style={[styles.badge, styles.adminBadge]}>
                    <Text style={styles.badgeText}>Admin</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View style={styles.footerSection}>
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup}>
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Members Modal */}
      <Modal
        visible={isAddMemberModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddMemberModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Members</Text>
            <Text style={styles.modalSubtitle}>Select contacts to add to this group:</Text>

            <FlatList
              data={addableContacts}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <View style={styles.emptyAddContainer}>
                  <Text style={styles.emptyAddText}>No addable contacts.</Text>
                  <Text style={styles.emptyAddSubtext}>
                    All your current direct contacts are already in this group.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedNewUserIds.includes(item._id);
                const userInit = (item.displayName || 'U').charAt(0).toUpperCase();

                return (
                  <TouchableOpacity
                    style={[styles.modalContactRow, isSelected && styles.modalContactRowSelected]}
                    onPress={() => toggleSelectNewMember(item._id)}
                  >
                    <View style={styles.avatarWrapper}>
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.contactAvatar} />
                      ) : (
                        <View style={styles.contactAvatarPlaceholder}>
                          <Text style={styles.contactAvatarText}>{userInit}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{item.displayName}</Text>
                      <Text style={styles.contactStatus} numberOfLines={1}>
                        {item.status}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setIsAddMemberModalOpen(false);
                  setSelectedNewUserIds([]);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  selectedNewUserIds.length === 0 && styles.disabledButton,
                ]}
                onPress={handleAddMembersSubmit}
                disabled={selectedNewUserIds.length === 0}
              >
                <Text style={styles.modalConfirmText}>ADD SELECTED</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  placeholder: {
    width: 60,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: COLORS.errorText,
    fontSize: 16,
    marginBottom: 20,
    fontWeight: '600',
  },
  infoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarText: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '800',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  avatarEditIcon: {
    fontSize: 12,
  },
  nameContainer: {
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  displayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  editIcon: {
    fontSize: 16,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  saveNameButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  saveNameText: {
    color: COLORS.primaryText,
    fontWeight: '800',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  participantHeaderTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    paddingLeft: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0a101b',
  },
  addIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  addMemberLabel: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 14,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0a101b',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberAvatarText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  memberName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  memberStatus: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  creatorBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  adminBadge: {
    backgroundColor: 'rgba(204, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(204, 255, 0, 0.25)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  footerSection: {
    padding: 24,
    alignItems: 'center',
  },
  leaveButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 24,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  leaveButtonText: {
    color: '#FCA5A5',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  emptyAddContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyAddText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyAddSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.8,
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0a101b',
  },
  modalContactRowSelected: {
    backgroundColor: 'rgba(204, 255, 0, 0.03)',
  },
  avatarWrapper: {
    position: 'relative',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  contactAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#070b13',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactAvatarText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  contactName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  contactStatus: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.primaryText,
    fontWeight: '900',
    fontSize: 11,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalConfirmButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: COLORS.primaryText,
    fontWeight: '800',
    fontSize: 15,
  },
});
