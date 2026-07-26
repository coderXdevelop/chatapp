import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';

export interface ActionOption {
  text: string;
  icon?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress: () => void;
}

interface CustomActionSheetModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ActionOption[];
  onClose: () => void;
}

export function CustomActionSheetModal({
  visible,
  title = 'Options',
  subtitle,
  options,
  onClose,
}: CustomActionSheetModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.container}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top Bar Indicator */}
          <View style={styles.topHandle} />

          {/* Title */}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {/* Options List */}
          <ScrollView contentContainerStyle={styles.optionsList} bounces={false}>
            {options
              .filter((opt) => opt.style !== 'cancel')
              .map((opt, index) => {
                const isDestructive = opt.style === 'destructive';
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionRow,
                      isDestructive && styles.optionRowDestructive,
                    ]}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        opt.onPress();
                      }, 100);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isDestructive && styles.optionTextDestructive,
                      ]}
                    >
                      {opt.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  topHandle: {
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  optionsList: {
    gap: 8,
    paddingVertical: 8,
  },
  optionRow: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionRowDestructive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  optionText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionTextDestructive: {
    color: '#FCA5A5',
  },
  cancelBtn: {
    backgroundColor: '#030712',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
});
