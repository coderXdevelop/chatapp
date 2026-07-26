import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../styles/theme';

interface QRCodeModalProps {
  visible: boolean;
  onClose: () => void;
  user: {
    displayName: string;
    connectId?: string;
    email: string;
    avatarUrl?: string;
  } | null;
  onAddContact?: (connectId: string) => void;
}

export function QRCodeModal({ visible, onClose, user, onAddContact }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const connectId = user.connectId || user.email.split('@')[0];
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(connectId)}&color=F59E0B&bgcolor=0F172A`;

  const handleCopyId = async () => {
    await Clipboard.setStringAsync(connectId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>My LinkUP QR Code</Text>
          <Text style={styles.subtitle}>Scan or share to connect instantly</Text>

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <Image
              source={{ uri: qrCodeUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          {/* User Details */}
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>{user.displayName}</Text>
            <TouchableOpacity style={styles.idChip} onPress={handleCopyId} activeOpacity={0.7}>
              <Text style={styles.idText}>@{connectId}</Text>
              <Text style={styles.copyBadge}>{copied ? 'Copied! ✓' : '📋 Copy'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '90%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrWrapper: {
    width: 220,
    height: 220,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  qrImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  userInfo: {
    alignItems: 'center',
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  idText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBadge: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
});
