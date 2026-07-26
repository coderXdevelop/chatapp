import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface ConfirmButtonOption {
  text: string;
  style?: 'default' | 'cancel' | 'destructive' | 'primary';
  onPress: () => void;
}

interface CustomConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: ConfirmButtonOption[];
  onClose: () => void;
  isLoading?: boolean;
}

export function CustomConfirmModal({
  visible,
  title,
  message,
  buttons = [],
  onClose,
  isLoading = false,
}: CustomConfirmModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.dialogCard}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {isLoading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="small" color="#F59E0B" />
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              {buttons.map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                const isPrimary = btn.style === 'primary';
                const isCancel = btn.style === 'cancel';

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.button,
                      isPrimary && styles.btnPrimary,
                      isDestructive && styles.btnDestructive,
                      isCancel && styles.btnCancel,
                    ]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        btn.onPress();
                      }, 100);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isPrimary && styles.btnTextPrimary,
                        isDestructive && styles.btnTextDestructive,
                        isCancel && styles.btnTextCancel,
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  loadingWrapper: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonsContainer: {
    gap: 10,
  },
  button: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  btnPrimary: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  btnDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  btnTextPrimary: {
    color: '#0F172A',
    fontWeight: '800',
  },
  btnTextDestructive: {
    color: '#FCA5A5',
  },
  btnTextCancel: {
    color: '#64748B',
  },
});
