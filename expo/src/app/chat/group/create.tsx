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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { COLORS, globalStyles } from '../../../styles/theme';
import { pickMedia, getCloudinarySignature, compressImage, uploadToCloudinary } from '../../../services/mediaUpload';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { chats, createGroup } = useChatStore();

  const [groupName, setGroupName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPublicId, setAvatarPublicId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [creating, setCreating] = useState(false);

  // Extract unique contacts from user's non-group chats
  const contacts = Array.from(
    new Map(
      chats
        .filter((c) => !c.isGroup)
        .flatMap((c) => c.participants)
        .filter((p) => p._id !== user?.id)
        .map((p) => [p._id, p])
    ).values()
  );

  const handleToggleSelect = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      if (selectedUserIds.length >= 149) {
        Alert.alert('Group Limit', 'You can select a maximum of 149 participants (excluding yourself).');
        return;
      }
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handlePickAvatar = async () => {
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

      setAvatarUrl(uploadedUrl);
      // Extra public_id extract if necessary
      const parts = uploadedUrl.split('/');
      const filename = parts.pop() || '';
      const publicId = filename.split('.')[0] || '';
      setAvatarPublicId(publicId);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation', 'Please enter a group name.');
      return;
    }
    if (selectedUserIds.length === 0) {
      Alert.alert('Validation', 'Please select at least one contact to join the group.');
      return;
    }

    setCreating(true);
    try {
      const chat = await createGroup(
        groupName.trim(),
        selectedUserIds,
        avatarUrl,
        avatarPublicId
      );

      if (chat) {
        Alert.alert('Success', `Group "${chat.name}" created successfully!`, [
          {
            text: 'OK',
            onPress: () => {
              // Redirect directly to the chat room
              router.replace(`/chat/${chat._id}` as any);
            },
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to create group. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.container}>
        {/* Setup Details */}
        <View style={styles.detailsCard}>
          <TouchableOpacity
            style={styles.avatarPicker}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : (
                  <Text style={styles.avatarPlaceholderText}>📸</Text>
                )}
              </View>
            )}
            <Text style={styles.avatarLabel}>Set Avatar</Text>
          </TouchableOpacity>

          <View style={[globalStyles.inputGroup, { flex: 1, marginLeft: 16 }]}>
            <Text style={globalStyles.label}>Group Name</Text>
            <View style={globalStyles.inputWrapper}>
              <TextInput
                style={globalStyles.input}
                placeholder="Enter group name..."
                placeholderTextColor={COLORS.textSecondary}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
              />
            </View>
          </View>
        </View>

        {/* Selected participants summary */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTitle}>Participants</Text>
          <Text style={styles.summaryCount}>
            {selectedUserIds.length} Selected (Max 149)
          </Text>
        </View>

        {/* Contacts selector list */}
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No contacts available to add.</Text>
              <Text style={styles.emptySubtext}>
                You can only add users with whom you have active direct chats.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedUserIds.includes(item._id);
            const initial = (item.displayName || 'C').charAt(0).toUpperCase();

            return (
              <TouchableOpacity
                style={[styles.contactRow, isSelected && styles.contactRowSelected]}
                onPress={() => handleToggleSelect(item._id)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrapper}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.contactAvatar} />
                  ) : (
                    <View style={styles.contactAvatarPlaceholder}>
                      <Text style={styles.contactAvatarText}>{initial}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{item.displayName}</Text>
                  <Text style={styles.contactStatus} numberOfLines={1}>
                    {item.status || 'Hey there! I am using ChatConnect.'}
                  </Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Creation button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              globalStyles.button,
              (creating || !groupName.trim() || selectedUserIds.length === 0) &&
                globalStyles.buttonDisabled,
            ]}
            onPress={handleCreate}
            disabled={creating || !groupName.trim() || selectedUserIds.length === 0}
          >
            {creating ? (
              <ActivityIndicator color={COLORS.primaryText} />
            ) : (
              <Text style={globalStyles.buttonText}>CREATE GROUP</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  detailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarPicker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#03050a',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarLabel: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0a101b',
  },
  summaryTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryCount: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0a101b',
  },
  contactRowSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  avatarWrapper: {
    position: 'relative',
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  contactAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactAvatarText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  contactName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  contactStatus: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    fontSize: 14,
  },
  footer: {
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
