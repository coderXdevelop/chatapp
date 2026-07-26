import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getStorageUsage,
  clearAppCache,
  deleteMediaCategory,
  getAutoCleanupSettings,
  saveAutoCleanupSettings,
  runAutoCleanup,
  formatBytes,
  StorageUsageResult,
  AutoCleanupSettings,
  MediaCategory,
} from '../services/storageManager';
import { COLORS, globalStyles } from '../styles/theme';

const CATEGORY_COLORS: Record<string, string> = {
  images: '#F59E0B',   // Amber
  videos: '#3B82F6',   // Blue
  audio: '#10B981',    // Emerald
  documents: '#EC4899',// Pink
  cache: '#8B5CF6',    // Purple
};

export default function StorageSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [usage, setUsage] = useState<StorageUsageResult | null>(null);
  const [cleanupSettings, setCleanupSettings] = useState<AutoCleanupSettings>({
    enabled: true,
    retentionDays: 30,
    maxStorageMB: 1024,
  });

  const loadData = useCallback(async () => {
    try {
      const [usageData, settingsData] = await Promise.all([
        getStorageUsage(),
        getAutoCleanupSettings(),
      ]);
      setUsage(usageData);
      setCleanupSettings(settingsData);
    } catch (e) {
      console.error('Failed to load storage settings data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will delete temporary image & app caches. Your downloaded chat media files will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await clearAppCache();
            setActionLoading(false);
            if (success) {
              Alert.alert('Success', 'Cache cleared successfully.');
              loadData();
            } else {
              Alert.alert('Error', 'Failed to clear cache.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteCategory = async (category: MediaCategory | 'all', label: string) => {
    Alert.alert(
      `Delete ${label}`,
      `Are you sure you want to delete all ${label.toLowerCase()} files from disk? They will need to be downloaded again from the server.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await deleteMediaCategory(category);
            setActionLoading(false);
            if (success) {
              Alert.alert('Success', `${label} files deleted.`);
              loadData();
            } else {
              Alert.alert('Error', `Failed to delete ${label.toLowerCase()} files.`);
            }
          },
        },
      ]
    );
  };

  const handleToggleAutoCleanup = async (newValue: boolean) => {
    const updated = { ...cleanupSettings, enabled: newValue };
    setCleanupSettings(updated);
    await saveAutoCleanupSettings(updated);
  };

  const handleSelectRetentionDays = async (days: number) => {
    const updated = { ...cleanupSettings, retentionDays: days };
    setCleanupSettings(updated);
    await saveAutoCleanupSettings(updated);
  };

  const handleSelectMaxStorageMB = async (mb: number) => {
    const updated = { ...cleanupSettings, maxStorageMB: mb };
    setCleanupSettings(updated);
    await saveAutoCleanupSettings(updated);
  };

  const handleRunCleanupNow = async () => {
    setActionLoading(true);
    const { deletedCount, deletedBytes } = await runAutoCleanup();
    setActionLoading(false);
    if (deletedCount > 0) {
      Alert.alert('Auto-Cleanup Finished', `Cleaned up ${deletedCount} file(s) freeing ${formatBytes(deletedBytes)}.`);
    } else {
      Alert.alert('Auto-Cleanup Finished', 'No expired or excess files found matching cleanup rules.');
    }
    loadData();
  };

  const totalBytes = usage?.totalBytes || 0;

  const getCategoryPercent = (catBytes: number): number => {
    if (!totalBytes || totalBytes === 0) return 0;
    return Math.max((catBytes / totalBytes) * 100, 1);
  };

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Storage & Data</Text>
          <Text style={styles.headerSubtitle}>Memory usage, cache cleanup & auto-rules</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Calculating storage usage...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        >
          {/* Main Usage Card */}
          <View style={styles.card}>
            <View style={styles.usageHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>App Storage Used</Text>
                <Text style={styles.totalSizeText}>{usage?.formattedTotal || '0 B'}</Text>
              </View>
              <View style={styles.totalBadge}>
                <Ionicons name="pie-chart-outline" size={18} color="#F59E0B" />
                <Text style={styles.totalBadgeText}>{usage?.totalCount || 0} items</Text>
              </View>
            </View>

            {/* Stacked Progress Bar */}
            <View style={styles.progressBarTrack}>
              {totalBytes > 0 ? (
                <>
                  <View style={[styles.progressChunk, { width: `${getCategoryPercent(usage?.categories.images.bytes || 0)}%`, backgroundColor: CATEGORY_COLORS.images }]} />
                  <View style={[styles.progressChunk, { width: `${getCategoryPercent(usage?.categories.videos.bytes || 0)}%`, backgroundColor: CATEGORY_COLORS.videos }]} />
                  <View style={[styles.progressChunk, { width: `${getCategoryPercent(usage?.categories.audio.bytes || 0)}%`, backgroundColor: CATEGORY_COLORS.audio }]} />
                  <View style={[styles.progressChunk, { width: `${getCategoryPercent(usage?.categories.documents.bytes || 0)}%`, backgroundColor: CATEGORY_COLORS.documents }]} />
                  <View style={[styles.progressChunk, { width: `${getCategoryPercent(usage?.categories.cache.bytes || 0)}%`, backgroundColor: CATEGORY_COLORS.cache }]} />
                </>
              ) : (
                <View style={[styles.progressChunk, { width: '100%', backgroundColor: '#1e293b' }]} />
              )}
            </View>

            {/* Color Legend */}
            <View style={styles.legendGrid}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS.images }]} />
                <Text style={styles.legendLabel}>Images</Text>
                <Text style={styles.legendValue}>{formatBytes(usage?.categories.images.bytes || 0)}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS.videos }]} />
                <Text style={styles.legendLabel}>Videos</Text>
                <Text style={styles.legendValue}>{formatBytes(usage?.categories.videos.bytes || 0)}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS.audio }]} />
                <Text style={styles.legendLabel}>Voice</Text>
                <Text style={styles.legendValue}>{formatBytes(usage?.categories.audio.bytes || 0)}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS.documents }]} />
                <Text style={styles.legendLabel}>Docs</Text>
                <Text style={styles.legendValue}>{formatBytes(usage?.categories.documents.bytes || 0)}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS.cache }]} />
                <Text style={styles.legendLabel}>Cache</Text>
                <Text style={styles.legendValue}>{formatBytes(usage?.categories.cache.bytes || 0)}</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions Card */}
          <Text style={styles.sectionHeader}>Quick Actions</Text>
          <View style={styles.card}>
            {/* Clear Cache */}
            <TouchableOpacity style={styles.actionRow} onPress={handleClearCache} disabled={actionLoading} activeOpacity={0.7}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                  <Ionicons name="trash-bin-outline" size={20} color="#8B5CF6" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={styles.actionTitle}>Clear Cache</Text>
                  <Text style={styles.actionSub}>Free temporary image and system cache</Text>
                </View>
              </View>
              <Text style={styles.actionBadge}>{formatBytes(usage?.categories.cache.bytes || 0)}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Purge All Media */}
            <TouchableOpacity style={styles.actionRow} onPress={() => handleDeleteCategory('all', 'All Media')} disabled={actionLoading} activeOpacity={0.7}>
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="flame-outline" size={20} color="#EF4444" />
                </View>
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionTitle, { color: '#EF4444' }]}>Delete All Downloaded Media</Text>
                  <Text style={styles.actionSub}>Remove stored photos, videos & voice messages</Text>
                </View>
              </View>
              <Text style={[styles.actionBadge, { color: '#EF4444' }]}>Purge</Text>
            </TouchableOpacity>
          </View>

          {/* Breakdown & Selective Delete */}
          <Text style={styles.sectionHeader}>Category Breakdown</Text>
          <View style={styles.card}>
            {/* Images */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Ionicons name="image-outline" size={20} color={CATEGORY_COLORS.images} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Photos & Stickers</Text>
                  <Text style={styles.catSub}>{usage?.categories.images.count || 0} files</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.images.bytes || 0)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory('images', 'Photo')}
                  style={styles.deleteMiniBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Videos */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Ionicons name="videocam-outline" size={20} color={CATEGORY_COLORS.videos} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Videos</Text>
                  <Text style={styles.catSub}>{usage?.categories.videos.count || 0} files</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.videos.bytes || 0)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory('videos', 'Video')}
                  style={styles.deleteMiniBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Voice / Audio */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Ionicons name="mic-outline" size={20} color={CATEGORY_COLORS.audio} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Voice Messages</Text>
                  <Text style={styles.catSub}>{usage?.categories.audio.count || 0} files</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.audio.bytes || 0)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory('audio', 'Voice')}
                  style={styles.deleteMiniBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Documents */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Ionicons name="document-text-outline" size={20} color={CATEGORY_COLORS.documents} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Documents</Text>
                  <Text style={styles.catSub}>{usage?.categories.documents.count || 0} files</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.documents.bytes || 0)}</Text>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory('documents', 'Document')}
                  style={styles.deleteMiniBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Auto-Cleanup Settings */}
          <Text style={styles.sectionHeader}>Auto-Cleanup Rules</Text>
          <View style={styles.card}>
            {/* Enable Toggle */}
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Ionicons name="sparkles-outline" size={20} color="#F59E0B" style={{ marginRight: 10 }} />
                <View>
                  <Text style={styles.switchTitle}>Enable Auto-Cleanup</Text>
                  <Text style={styles.switchSub}>Automatically remove old media in background</Text>
                </View>
              </View>
              <Switch
                value={cleanupSettings.enabled}
                onValueChange={handleToggleAutoCleanup}
                trackColor={{ false: '#162235', true: COLORS.primary }}
                thumbColor={Platform.OS === 'android' ? (cleanupSettings.enabled ? COLORS.primaryText : '#888') : undefined}
              />
            </View>

            {cleanupSettings.enabled && (
              <>
                <View style={styles.divider} />

                {/* Retention Threshold */}
                <Text style={styles.optionLabel}>Keep Media Files For:</Text>
                <View style={styles.chipRow}>
                  {[7, 30, 90, 365].map((days) => {
                    const isSelected = cleanupSettings.retentionDays === days;
                    const label = days === 365 ? '1 Year' : `${days} Days`;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => handleSelectRetentionDays(days)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Max Storage Limit */}
                <Text style={styles.optionLabel}>Maximum Media Storage Limit:</Text>
                <View style={styles.chipRow}>
                  {[512, 1024, 2048, 0].map((mb) => {
                    const isSelected = cleanupSettings.maxStorageMB === mb;
                    const label = mb === 0 ? 'Unlimited' : mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
                    return (
                      <TouchableOpacity
                        key={mb}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => handleSelectMaxStorageMB(mb)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.divider} />

                {/* Trigger Manual Cleanup */}
                <TouchableOpacity
                  style={styles.runCleanupBtn}
                  onPress={handleRunCleanupNow}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#0B111E" />
                  ) : (
                    <>
                      <Ionicons name="flash-outline" size={18} color="#0B111E" style={{ marginRight: 6 }} />
                      <Text style={styles.runCleanupText}>Run Cleanup Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#162235',
    backgroundColor: '#0B111E',
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  refreshButton: {
    padding: 8,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 10,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#101622',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  usageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalSizeText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  totalBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#162235',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressChunk: {
    height: '100%',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '30%',
    marginVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginRight: 4,
  },
  legendValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  actionBadge: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#1F293D',
    marginVertical: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  catIcon: {
    marginRight: 12,
    width: 22,
  },
  catTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  catSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catSize: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 12,
  },
  deleteMiniBtn: {
    padding: 6,
    backgroundColor: '#162235',
    borderRadius: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  switchSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  optionLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#162235',
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0B111E',
    fontWeight: '700',
  },
  runCleanupBtn: {
    flexDirection: 'row',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  runCleanupText: {
    color: '#0B111E',
    fontSize: 13,
    fontWeight: '700',
  },
});
