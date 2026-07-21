import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile, isLoading } = useAuthStore();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [newAge, setNewAge] = useState(user?.age ? String(user.age) : '');
  const [newStatus, setNewStatus] = useState(user?.status || '');

  const handleOpenEdit = () => {
    setNewDisplayName(user?.displayName || '');
    setNewAge(user?.age ? String(user.age) : '');
    setNewStatus(user?.status || '');
    setIsEditModalOpen(true);
  };

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
      setIsEditModalOpen(false);
    } else {
      Alert.alert('Error', 'Failed to update profile details.');
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

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading user profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial = (user.displayName || 'C').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>● Verified Session</Text>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>

          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.emailText}>{user.email}</Text>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>STATUS</Text>
            <Text style={styles.statusText}>"{user.status}"</Text>
          </View>

          <TouchableOpacity style={styles.editButton} onPress={handleOpenEdit}>
            <Text style={styles.editButtonText}>✎ Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Account Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionHeader}>ACCOUNT DATA</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>User ID</Text>
            <Text style={styles.detailValueMono} numberOfLines={1} ellipsizeMode="middle">
              {user.id}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Age</Text>
            <Text style={styles.detailValue}>{user.age ? `${user.age} years old` : 'Not specified'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Auth Method</Text>
            <Text style={styles.detailValue}>Email OTP + JWT Session</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registered</Text>
            <Text style={styles.detailValue}>
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <Text style={styles.logoutButtonText}>Sign Out of ChatConnect</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Profile</Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.modalInput}
                value={newDisplayName}
                onChangeText={setNewDisplayName}
                placeholder="Display Name"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>AGE</Text>
              <TextInput
                style={styles.modalInput}
                value={newAge}
                onChangeText={setNewAge}
                placeholder="Age (e.g. 24)"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalLabel}>STATUS</Text>
              <TextInput
                style={styles.modalInput}
                value={newStatus}
                onChangeText={setNewStatus}
                placeholder="Status message"
                placeholderTextColor="#64748B"
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalButton}
                onPress={handleSaveProfile}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#0F172A" />
                ) : (
                  <Text style={styles.saveModalText}>Save Changes</Text>
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
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
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
    color: '#F8FAFC',
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#78350F',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F172A',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginBottom: 16,
  },
  statusBox: {
    backgroundColor: '#0F172A',
    width: '100%',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  editButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  detailValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  detailValueMono: {
    color: '#F59E0B',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxWidth: 200,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 20,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelModalText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  saveModalButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveModalText: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
