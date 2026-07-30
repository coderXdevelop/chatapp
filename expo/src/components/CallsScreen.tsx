import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useCallContext } from '../store/CallContext';
import { COLORS } from '../styles/theme';

export interface CallLogItem {
  _id: string;
  callId: string;
  chatId: string;
  isCaller: boolean;
  peer: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  isVideo: boolean;
  callStatus: 'accepted' | 'declined' | 'missed';
  durationSeconds: number;
  text: string;
  createdAt: string;
}

export const CallsScreen: React.FC = () => {
  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const { startCall, isCallFeatureEnabled } = useCallContext();

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get('/api/calls/logs');
      if (res.data && res.data.success) {
        setLogs(res.data.logs);
      }
    } catch (e) {
      console.error('Fetch call logs error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLogs();
  }, [fetchLogs]);

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeStr}`;
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    }

    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const renderCallLogItem = ({ item }: { item: CallLogItem }) => {
    const isMissedOrDeclined = item.callStatus !== 'accepted';

    // Status Arrow & Color logic
    let arrowIconName: keyof typeof Ionicons.glyphMap = 'arrow-up-outline';
    let arrowColor = '#10B981'; // Green for outgoing

    if (item.isCaller) {
      arrowIconName = 'arrow-up-outline';
      arrowColor = item.callStatus === 'accepted' ? '#10B981' : '#EF4444';
    } else {
      arrowIconName = 'arrow-down-outline';
      arrowColor = item.callStatus === 'accepted' ? '#3B82F6' : '#EF4444';
    }

    return (
      <View style={styles.logCard}>
        {/* User Avatar */}
        <View style={styles.avatarWrapper}>
          {item.peer.avatarUrl ? (
            <Image source={{ uri: item.peer.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {item.peer.displayName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.infoCol}>
          <Text style={[styles.peerName, isMissedOrDeclined && !item.isCaller && styles.missedText]}>
            {item.peer.displayName || 'Unknown'}
          </Text>

          <View style={styles.statusRow}>
            <Ionicons name={arrowIconName} size={15} color={arrowColor} style={styles.arrowIcon} />
            <Ionicons
              name={item.isVideo ? 'videocam-outline' : 'call-outline'}
              size={14}
              color={COLORS.textSecondary}
              style={styles.callTypeIcon}
            />
            <Text style={styles.statusSubtext}>{formatTimestamp(item.createdAt)}</Text>
          </View>
        </View>

        {/* Right Callback Action Icons */}
        {isCallFeatureEnabled && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.callbackBtn}
              onPress={() =>
                startCall({
                  recipientId: item.peer._id,
                  displayName: item.peer.displayName,
                  avatarUrl: item.peer.avatarUrl,
                  isVideo: false,
                  chatId: item.chatId,
                })
              }
            >
              <Ionicons name="call" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.callbackBtn}
              onPress={() =>
                startCall({
                  recipientId: item.peer._id,
                  displayName: item.peer.displayName,
                  avatarUrl: item.peer.avatarUrl,
                  isVideo: true,
                  chatId: item.chatId,
                })
              }
            >
              <Ionicons name="videocam" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBanner}>
        <Text style={styles.headerTitle}>Call History</Text>
        <Text style={styles.headerSubtitle}>Recent Voice & Video Calls</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item._id}
        renderItem={renderCallLogItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="call-outline" size={56} color="#475569" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Recent Calls</Text>
            <Text style={styles.emptySubtext}>Your voice and video call logs will appear here.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerBanner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarWrapper: {
    marginRight: 14,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  peerName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  missedText: {
    color: '#EF4444',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    marginRight: 4,
  },
  callTypeIcon: {
    marginRight: 6,
  },
  statusSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callbackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
