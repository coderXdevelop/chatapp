import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import {
  getStorageUsage,
  clearAppCache,
  deleteMediaCategory,
  getAutoCleanupSettings,
  saveAutoCleanupSettings,
  runAutoCleanup,
  getCategoryFiles,
  deleteIndividualFile,
  deleteMultipleFiles,
  formatBytes,
  StorageUsageResult,
  AutoCleanupSettings,
  MediaCategory,
  MediaFileDetail,
} from '../services/storageManager';
import { COLORS, globalStyles } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_COLORS: Record<string, string> = {
  images: '#F59E0B',   // Amber
  videos: '#3B82F6',   // Blue
  audio: '#10B981',    // Emerald
  documents: '#EC4899',// Pink
  cache: '#8B5CF6',    // Purple
};

const CATEGORY_TITLES: Record<MediaCategory, string> = {
  images: 'Photos & Stickers',
  videos: 'Videos',
  audio: 'Voice Messages',
  documents: 'Documents',
  cache: 'System Cache',
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

  // Category Explorer Modal State
  const [activeCategory, setActiveCategory] = useState<MediaCategory | null>(null);
  const [categoryFiles, setCategoryFiles] = useState<MediaFileDetail[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Full Screen Image Preview State
  const [previewImage, setPreviewImage] = useState<MediaFileDetail | null>(null);

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: any[];
  }>({
    visible: false,
    title: '',
    buttons: [],
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

  const openCategoryExplorer = async (category: MediaCategory) => {
    setActiveCategory(category);
    setFilesLoading(true);
    setSelectedUris(new Set());
    setIsMultiSelectMode(false);
    try {
      const files = await getCategoryFiles(category);
      setCategoryFiles(files);
    } catch (e) {
      console.error('Failed to get category files:', e);
    } finally {
      setFilesLoading(false);
    }
  };

  const closeCategoryExplorer = () => {
    setActiveCategory(null);
    setCategoryFiles([]);
    setSelectedUris(new Set());
    setIsMultiSelectMode(false);
    loadData();
  };

  const handleClearCache = async () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Clear Cache',
      message: 'This will delete temporary image & app caches. Your downloaded chat media files will not be deleted.',
      buttons: [
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await clearAppCache();
            setActionLoading(false);
            if (success) {
              setConfirmModalConfig({
                visible: true,
                title: 'Success',
                message: 'Cache cleared successfully.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
              });
              loadData();
            } else {
              setConfirmModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to clear cache.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
      ],
    });
  };

  const handleDeleteCategory = async (category: MediaCategory | 'all', label: string) => {
    setConfirmModalConfig({
      visible: true,
      title: `Delete All ${label}`,
      message: `Are you sure you want to delete all ${label.toLowerCase()} files from disk? They will need to be downloaded again from the server.`,
      buttons: [
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const success = await deleteMediaCategory(category);
            setActionLoading(false);
            if (success) {
              setConfirmModalConfig({
                visible: true,
                title: 'Success',
                message: `All ${label.toLowerCase()} files deleted.`,
                buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
              });
              loadData();
              if (activeCategory === category || category === 'all') {
                closeCategoryExplorer();
              }
            } else {
              setConfirmModalConfig({
                visible: true,
                title: 'Error',
                message: `Failed to delete ${label.toLowerCase()} files.`,
                buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
      ],
    });
  };

  const handleDeleteSingleFile = (file: MediaFileDetail) => {
    setConfirmModalConfig({
      visible: true,
      title: 'Delete File',
      message: `Delete "${file.name}" (${file.formattedSize}) permanently from your device?`,
      buttons: [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteIndividualFile(file.uri);
            if (ok) {
              setCategoryFiles((prev) => prev.filter((f) => f.uri !== file.uri));
              setSelectedUris((prev) => {
                const next = new Set(prev);
                next.delete(file.uri);
                return next;
              });
              if (previewImage?.uri === file.uri) {
                setPreviewImage(null);
              }
              loadData();
            } else {
              setConfirmModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to delete file.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
      ],
    });
  };

  const handleDeleteSelectedBatch = () => {
    if (selectedUris.size === 0) return;

    const count = selectedUris.size;
    const urisToDelete = Array.from(selectedUris);
    const totalSelectedBytes = categoryFiles
      .filter((f) => selectedUris.has(f.uri))
      .reduce((acc, curr) => acc + curr.size, 0);

    setConfirmModalConfig({
      visible: true,
      title: 'Delete Selected Items',
      message: `Permanently delete ${count} selected item(s) freeing ${formatBytes(totalSelectedBytes)}?`,
      buttons: [
        {
          text: `Delete (${count})`,
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const { deletedCount } = await deleteMultipleFiles(urisToDelete);
            setActionLoading(false);
            if (deletedCount > 0) {
              setCategoryFiles((prev) => prev.filter((f) => !selectedUris.has(f.uri)));
              setSelectedUris(new Set());
              setIsMultiSelectMode(false);
              loadData();
            } else {
              setConfirmModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to delete selected files.',
                buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
              });
            }
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
      ],
    });
  };

  const toggleSelectFile = (uri: string) => {
    setSelectedUris((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedUris.size === categoryFiles.length) {
      setSelectedUris(new Set());
    } else {
      setSelectedUris(new Set(categoryFiles.map((f) => f.uri)));
    }
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
      setConfirmModalConfig({
        visible: true,
        title: 'Auto-Cleanup Finished',
        message: `Cleaned up ${deletedCount} file(s) freeing ${formatBytes(deletedBytes)}.`,
        buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
      });
    } else {
      setConfirmModalConfig({
        visible: true,
        title: 'Auto-Cleanup Finished',
        message: 'No expired or excess files found matching cleanup rules.',
        buttons: [{ text: 'OK', style: 'primary', onPress: () => {} }],
      });
    }
    loadData();
  };

  const totalBytes = usage?.totalBytes || 0;

  const getCategoryPercent = (catBytes: number): number => {
    if (!totalBytes || totalBytes === 0) return 0;
    return Math.max((catBytes / totalBytes) * 100, 1);
  };

  const renderGridItem = ({ item }: { item: MediaFileDetail }) => {
    const isSelected = selectedUris.has(item.uri);

    if (activeCategory === 'images') {
      const gridWidth = (SCREEN_WIDTH - 48) / 3;
      return (
        <TouchableOpacity
          style={[styles.gridCard, { width: gridWidth, height: gridWidth }]}
          onPress={() => {
            if (isMultiSelectMode) {
              toggleSelectFile(item.uri);
            } else {
              setPreviewImage(item);
            }
          }}
          onLongPress={() => {
            if (!isMultiSelectMode) {
              setIsMultiSelectMode(true);
              toggleSelectFile(item.uri);
            }
          }}
          activeOpacity={0.8}
        >
          <Image source={{ uri: item.uri }} style={styles.gridImage} contentFit="cover" />
          <View style={styles.gridOverlayBadge}>
            <Text style={styles.gridBadgeText}>{item.formattedSize}</Text>
          </View>
          {isMultiSelectMode ? (
            <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#0B111E" />}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.singleDeleteBtn}
              onPress={() => handleDeleteSingleFile(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    }

    if (activeCategory === 'videos') {
      const videoWidth = (SCREEN_WIDTH - 40) / 2;
      return (
        <TouchableOpacity
          style={[styles.videoCard, { width: videoWidth }]}
          onPress={() => {
            if (isMultiSelectMode) {
              toggleSelectFile(item.uri);
            } else {
              handleDeleteSingleFile(item);
            }
          }}
          onLongPress={() => {
            if (!isMultiSelectMode) {
              setIsMultiSelectMode(true);
              toggleSelectFile(item.uri);
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={32} color="#3B82F6" />
            <View style={styles.playCircle}>
              <Ionicons name="play" size={14} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.itemDetailBody}>
            <Text style={styles.fileNameText} numberOfLines={1}>{item.name}</Text>
            <View style={styles.fileMetaRow}>
              <Text style={styles.fileSizeText}>{item.formattedSize}</Text>
              <Text style={styles.fileDateText}>{item.formattedDate}</Text>
            </View>
          </View>
          {isMultiSelectMode ? (
            <View style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive, { top: 8, right: 8 }]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#0B111E" />}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cardTrashBtn}
              onPress={() => handleDeleteSingleFile(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    }

    // Audio & Documents List View
    const iconName = activeCategory === 'audio' ? 'mic' : 'document-text';
    const iconColor = activeCategory === 'audio' ? CATEGORY_COLORS.audio : CATEGORY_COLORS.documents;

    return (
      <TouchableOpacity
        style={[styles.listItemCard, isSelected && styles.listItemCardSelected]}
        onPress={() => {
          if (isMultiSelectMode) {
            toggleSelectFile(item.uri);
          } else {
            handleDeleteSingleFile(item);
          }
        }}
        onLongPress={() => {
          if (!isMultiSelectMode) {
            setIsMultiSelectMode(true);
            toggleSelectFile(item.uri);
          }
        }}
        activeOpacity={0.7}
      >
        {isMultiSelectMode && (
          <View style={[styles.selectCheckboxList, isSelected && styles.selectCheckboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#0B111E" />}
          </View>
        )}
        <View style={[styles.listIconCircle, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        <View style={styles.listTextContainer}>
          <Text style={styles.fileNameText} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.fileMetaText}>{item.formattedSize} • {item.formattedDate}</Text>
        </View>
        {!isMultiSelectMode && (
          <TouchableOpacity
            style={styles.listDeleteBtn}
            onPress={() => handleDeleteSingleFile(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
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
            <TouchableOpacity style={styles.actionRow} onPress={() => handleDeleteCategory('all', 'Media')} disabled={actionLoading} activeOpacity={0.7}>
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

          {/* Breakdown & Selective Delete - Tap to view individual items! */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Category Breakdown</Text>
            <Text style={styles.sectionHint}>Tap category to view & delete individual items</Text>
          </View>
          <View style={styles.card}>
            {/* Images */}
            <TouchableOpacity
              style={styles.breakdownRow}
              onPress={() => openCategoryExplorer('images')}
              activeOpacity={0.7}
            >
              <View style={styles.breakdownLeft}>
                <Ionicons name="image-outline" size={20} color={CATEGORY_COLORS.images} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Photos & Stickers</Text>
                  <Text style={styles.catSub}>{usage?.categories.images.count || 0} files • Tap to inspect</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.images.bytes || 0)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Videos */}
            <TouchableOpacity
              style={styles.breakdownRow}
              onPress={() => openCategoryExplorer('videos')}
              activeOpacity={0.7}
            >
              <View style={styles.breakdownLeft}>
                <Ionicons name="videocam-outline" size={20} color={CATEGORY_COLORS.videos} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Videos</Text>
                  <Text style={styles.catSub}>{usage?.categories.videos.count || 0} files • Tap to inspect</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.videos.bytes || 0)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Voice / Audio */}
            <TouchableOpacity
              style={styles.breakdownRow}
              onPress={() => openCategoryExplorer('audio')}
              activeOpacity={0.7}
            >
              <View style={styles.breakdownLeft}>
                <Ionicons name="mic-outline" size={20} color={CATEGORY_COLORS.audio} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Voice Messages</Text>
                  <Text style={styles.catSub}>{usage?.categories.audio.count || 0} files • Tap to inspect</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.audio.bytes || 0)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Documents */}
            <TouchableOpacity
              style={styles.breakdownRow}
              onPress={() => openCategoryExplorer('documents')}
              activeOpacity={0.7}
            >
              <View style={styles.breakdownLeft}>
                <Ionicons name="document-text-outline" size={20} color={CATEGORY_COLORS.documents} style={styles.catIcon} />
                <View>
                  <Text style={styles.catTitle}>Documents</Text>
                  <Text style={styles.catSub}>{usage?.categories.documents.count || 0} files • Tap to inspect</Text>
                </View>
              </View>
              <View style={styles.breakdownRight}>
                <Text style={styles.catSize}>{formatBytes(usage?.categories.documents.bytes || 0)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </View>
            </TouchableOpacity>
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

      {/* Category Media Items Explorer Modal */}
      <Modal
        visible={activeCategory !== null}
        animationType="slide"
        onRequestClose={closeCategoryExplorer}
      >
        <SafeAreaView style={[globalStyles.safeArea, { backgroundColor: '#0B111E' }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeCategoryExplorer} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {activeCategory ? CATEGORY_TITLES[activeCategory] : 'Media Items'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {categoryFiles.length} file(s) • {formatBytes(categoryFiles.reduce((sum, f) => sum + f.size, 0))} total
              </Text>
            </View>

            {categoryFiles.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  if (isMultiSelectMode) {
                    setIsMultiSelectMode(false);
                    setSelectedUris(new Set());
                  } else {
                    setIsMultiSelectMode(true);
                  }
                }}
                style={styles.selectToggleBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.selectToggleText}>
                  {isMultiSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Multi-Select Action Bar */}
          {isMultiSelectMode && (
            <View style={styles.batchBar}>
              <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7}>
                <Text style={styles.batchActionText}>
                  {selectedUris.size === categoryFiles.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.batchCountText}>
                {selectedUris.size} selected ({formatBytes(categoryFiles.filter(f => selectedUris.has(f.uri)).reduce((acc, c) => acc + c.size, 0))})
              </Text>
              <TouchableOpacity
                onPress={handleDeleteSelectedBatch}
                disabled={selectedUris.size === 0}
                style={[styles.batchDeleteBtn, selectedUris.size === 0 && { opacity: 0.4 }]}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.batchDeleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Files List / Grid */}
          {filesLoading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={COLORS.accent} />
              <Text style={styles.loadingText}>Loading file items...</Text>
            </View>
          ) : categoryFiles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={56} color="#334155" />
              <Text style={styles.emptyTitle}>No Media Files Found</Text>
              <Text style={styles.emptySub}>Downloaded files in this category will appear here for individual management.</Text>
            </View>
          ) : (
            <FlatList
              data={categoryFiles}
              keyExtractor={(item) => item.uri}
              renderItem={renderGridItem}
              numColumns={activeCategory === 'images' ? 3 : activeCategory === 'videos' ? 2 : 1}
              key={activeCategory === 'images' ? 'grid3' : activeCategory === 'videos' ? 'grid2' : 'list1'}
              contentContainerStyle={styles.gridContainer}
              columnWrapperStyle={activeCategory === 'images' || activeCategory === 'videos' ? styles.columnWrapper : undefined}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Full Screen Image Preview & Delete Modal */}
      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewContainer}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewImage(null)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {previewImage && (
            <>
              <Image source={{ uri: previewImage.uri }} style={styles.previewImageFull} contentFit="contain" />
              
              <View style={styles.previewFooter}>
                <View>
                  <Text style={styles.previewFileName} numberOfLines={1}>{previewImage.name}</Text>
                  <Text style={styles.previewFileMeta}>{previewImage.formattedSize} • {previewImage.formattedDate}</Text>
                </View>
                <TouchableOpacity
                  style={styles.previewDeleteBtn}
                  onPress={() => handleDeleteSingleFile(previewImage)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.previewDeleteText}>Delete Photo</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Dark Confirm Dialog Modal */}
      <CustomConfirmModal
        visible={confirmModalConfig.visible}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        buttons={confirmModalConfig.buttons}
        onClose={() => setConfirmModalConfig((prev) => ({ ...prev, visible: false }))}
      />
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  sectionHint: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
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
    paddingVertical: 6,
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
    marginRight: 8,
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

  // Modal Explorer Styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#162235',
    backgroundColor: '#0B111E',
  },
  selectToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#162235',
  },
  selectToggleText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#101622',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F293D',
  },
  batchActionText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '700',
  },
  batchCountText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  batchDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  batchDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gridContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  columnWrapper: {
    gap: 8,
    marginBottom: 8,
  },
  gridCard: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#101622',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlayBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(7, 11, 19, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  singleDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCheckbox: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCheckboxActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  videoCard: {
    backgroundColor: '#101622',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F293D',
    position: 'relative',
  },
  videoPlaceholder: {
    height: 90,
    backgroundColor: '#070B13',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetailBody: {
    padding: 10,
  },
  fileNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  fileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  fileSizeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  fileDateText: {
    color: '#64748B',
    fontSize: 10,
  },
  cardTrashBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#162235',
    padding: 6,
    borderRadius: 8,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101622',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  listItemCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#162235',
  },
  selectCheckboxList: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#64748B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  listIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listTextContainer: {
    flex: 1,
  },
  fileMetaText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  listDeleteBtn: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // Preview Modal Styles
  previewContainer: {
    flex: 1,
    backgroundColor: 'rgba(7, 11, 19, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImageFull: {
    width: '90%',
    height: '70%',
  },
  previewFooter: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101622',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F293D',
  },
  previewFileName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 180,
  },
  previewFileMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  previewDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  previewDeleteText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
