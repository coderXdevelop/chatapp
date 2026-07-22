import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { COLORS, globalStyles } from '../styles/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    user,
    logout,
    updateProfile,
    removeAvatar,
    forgotPassword,
    resetPassword,
    deleteAccount,
    isLoading,
  } = useAuthStore();

  const [currentView, setCurrentView] = useState<'MAIN' | 'PERSONAL_INFO'>('MAIN');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);

  // Profile Edit fields
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newStatus, setNewStatus] = useState('');

  // Password reset fields
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securePassword, setSecurePassword] = useState(true);

  // Sync profile details when user data is available or view changes
  useEffect(() => {
    if (user) {
      setNewDisplayName(user.displayName || '');
      setNewAge(user.age ? String(user.age) : '');
      setNewStatus(user.status || '');
    }
  }, [user, currentView]);

  if (!user) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading user profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if any change has been made to enable the Save button
  const hasProfileChanges =
    newDisplayName.trim() !== (user.displayName || '').trim() ||
    newAge.trim() !== String(user.age || '') ||
    newStatus.trim() !== (user.status || '').trim();

  const handleSaveProfile = async () => {
    if (newAge && (isNaN(Number(newAge)) || Number(newAge) < 1 || Number(newAge) > 120)) {
      Alert.alert('Invalid Age', 'Please enter a valid age between 1 and 120.');
      return;
    }

    const success = await updateProfile({
      displayName: newDisplayName.trim(),
      age: newAge ? Number(newAge) : undefined,
      status: newStatus.trim(),
    });

    if (success) {
      Alert.alert('Success', 'Profile updated successfully.');
      setCurrentView('MAIN');
    } else {
      Alert.alert('Error', 'Failed to update profile details.');
    }
  };

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const base64Data = asset.base64
          ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
          : asset.uri;
        const ok = await updateProfile({ avatarUrl: base64Data });
        if (!ok) {
          Alert.alert('Error', 'Failed to update profile picture.');
        }
      }
    } catch (err: any) {
      console.error('Pick avatar error:', err);
      Alert.alert('Error', 'Could not open image library.');
    }
  };

  const handleRemoveAvatar = async () => {
    const ok = await removeAvatar();
    if (!ok) {
      Alert.alert('Error', 'Failed to remove profile picture.');
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(
      'Profile Picture',
      'Choose an option to update your profile picture:',
      [
        { text: 'Cancel', style: 'cancel' as const },
        { text: '📷 Choose from Library', onPress: handlePickAvatar },
        ...(user.avatarUrl ? [{ text: '🗑️ Remove Picture', style: 'destructive' as const, onPress: handleRemoveAvatar }] : []),
      ]
    );
  };

  const handlePasswordResetInit = async () => {
    setIsResetLoading(true);
    try {
      const res = await forgotPassword(user.email);
      if (res.success) {
        setResetOtpCode('');
        setNewPassword('');
        setIsResetModalOpen(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to send OTP code.');
      }
    } catch (err: any) {
      console.error('Password reset init error:', err);
      Alert.alert('Error', 'Failed to request password reset.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handlePasswordResetSubmit = async () => {
    if (!resetOtpCode || resetOtpCode.trim().length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must be at least 6 characters long.');
      return;
    }

    setIsResetLoading(true);
    try {
      const res = await resetPassword(user.email, resetOtpCode.trim(), newPassword);
      if (res.success) {
        setIsResetModalOpen(false);
        Alert.alert('Success', 'Your password has been reset successfully. Please sign in again with your new credentials.', [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              router.replace('/login' as any);
            },
          },
        ]);
      } else {
        Alert.alert('Error', res.message || 'Failed to reset password.');
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      Alert.alert('Error', 'Failed to reset password.');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login' as any);
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAccount();
            if (res.success) {
              Alert.alert('Success', 'Your account has been deleted.');
              router.replace('/login' as any);
            } else {
              Alert.alert('Error', res.message || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  const initial = (user.displayName || 'C').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      {currentView === 'MAIN' ? (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.pageTitle}>Profile</Text>
              <Text style={styles.pageSubtitle}>Manage your account, security, and preferences.</Text>
            </View>
          </View>

          {/* Settings List Card */}
          <View style={globalStyles.card}>
            {/* Personal Information */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setCurrentView('PERSONAL_INFO')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Text style={styles.menuIcon}>👤</Text>
                </View>
                <Text style={styles.menuItemText}>Personal Information</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Notification */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => Alert.alert('Notifications', 'Notification settings coming soon.')}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  <Text style={styles.menuIcon}>🔔</Text>
                </View>
                <Text style={styles.menuItemText}>Notification</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Password Reset */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handlePasswordResetInit}
              activeOpacity={0.7}
              disabled={isResetLoading}
            >
              <View style={styles.menuItemLeft}>
                <View style={styles.iconCircle}>
                  {isResetLoading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Text style={styles.menuIcon}>🔑</Text>
                  )}
                </View>
                <Text style={styles.menuItemText}>Password Reset</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Log Out */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconCircle, styles.destructiveIconCircle]}>
                  <Text style={[styles.menuIcon, styles.destructiveMenuIcon]}>⏻</Text>
                </View>
                <Text style={[styles.menuItemText, styles.destructiveMenuItemText]}>Log Out</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Delete Account */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconCircle, styles.destructiveIconCircle]}>
                  <Text style={[styles.menuIcon, styles.destructiveMenuIcon]}>🗑️</Text>
                </View>
                <Text style={[styles.menuItemText, styles.destructiveMenuItemText]}>Delete Account</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Sub Header for Personal Information */}
          <View style={styles.subHeaderRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentView('MAIN')}>
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>Personal Information</Text>
            <TouchableOpacity style={styles.dotsButton} onPress={() => {}}>
              <Text style={styles.dotsButtonText}>⋮</Text>
            </TouchableOpacity>
          </View>

          {/* Central Avatar Uploader */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleAvatarPress}
              activeOpacity={0.8}
            >
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Text style={styles.cameraIcon}>📷</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Inputs Section */}
          <View style={globalStyles.card}>
            {/* Full Name */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>FULL NAME</Text>
              <View style={globalStyles.inputWrapper}>
                <TextInput
                  style={globalStyles.input}
                  value={newDisplayName}
                  onChangeText={setNewDisplayName}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            {/* User ID */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>USER ID (SHARE THIS WITH FRIENDS)</Text>
              <View style={[globalStyles.inputWrapper, styles.disabledInputWrapper]}>
                <TextInput
                  style={[globalStyles.input, styles.disabledInput]}
                  value={user.connectId || 'Not Allocated'}
                  editable={false}
                  placeholder="User ID"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            {/* Email Address */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>EMAIL ADDRESS</Text>
              <View style={[globalStyles.inputWrapper, styles.disabledInputWrapper]}>
                <TextInput
                  style={[globalStyles.input, styles.disabledInput]}
                  value={user.email}
                  editable={false}
                  placeholder="Email Address"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            {/* Age */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>AGE</Text>
              <View style={globalStyles.inputWrapper}>
                <TextInput
                  style={globalStyles.input}
                  value={newAge}
                  onChangeText={setNewAge}
                  placeholder="Age (e.g. 24)"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Status */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>STATUS</Text>
              <View style={globalStyles.inputWrapper}>
                <TextInput
                  style={[globalStyles.input, styles.multilineInput]}
                  value={newStatus}
                  onChangeText={setNewStatus}
                  placeholder="Status message"
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>

            {/* Save Changes Button */}
            <TouchableOpacity
              style={[
                globalStyles.button,
                (!hasProfileChanges || isLoading) && globalStyles.buttonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={!hasProfileChanges || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.primaryText} />
              ) : (
                <Text style={globalStyles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Password Reset OTP & New Password Modal */}
      <Modal
        visible={isResetModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsResetModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              We've sent a 6-digit verification code to {user.email}.
            </Text>

            {/* OTP Input */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>VERIFICATION CODE</Text>
              <View style={globalStyles.inputWrapper}>
                <TextInput
                  style={globalStyles.input}
                  value={resetOtpCode}
                  onChangeText={setResetOtpCode}
                  placeholder="6-digit code"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            {/* New Password Input */}
            <View style={globalStyles.inputGroup}>
              <Text style={globalStyles.label}>NEW PASSWORD</Text>
              <View style={globalStyles.inputWrapper}>
                <TextInput
                  style={globalStyles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry={securePassword}
                />
                <TouchableOpacity onPress={() => setSecurePassword(!securePassword)}>
                  <Text style={styles.eyeIcon}>{securePassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setIsResetModalOpen(false)}
                disabled={isResetLoading}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalButton, isResetLoading && styles.disabledModalButton]}
                onPress={handlePasswordResetSubmit}
                disabled={isResetLoading}
              >
                {isResetLoading ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <Text style={styles.saveModalText}>Reset Password</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  container: {
    padding: 24,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  // Menu Item styling matching mockup
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  destructiveIconCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  menuIcon: {
    fontSize: 16,
  },
  destructiveMenuIcon: {
    color: '#EF4444',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  destructiveMenuItemText: {
    color: '#EF4444',
  },
  menuChevron: {
    fontSize: 22,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  // Personal Info Header
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: COLORS.textPrimary,
    lineHeight: 32,
    textAlign: 'center',
  },
  subHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  dotsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsButtonText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 3,
    borderColor: COLORS.border,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 47,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 42,
    fontWeight: '800',
    color: '#070b13',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  cameraIcon: {
    fontSize: 14,
  },
  // Form fields
  disabledInputWrapper: {
    backgroundColor: '#05080f',
    opacity: 0.75,
  },
  disabledInput: {
    color: COLORS.textSecondary,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  eyeIcon: {
    fontSize: 18,
    paddingHorizontal: 8,
  },
  // Password Reset Modal
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
