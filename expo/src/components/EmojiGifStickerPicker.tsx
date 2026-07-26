import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { WhatsAppEmojiSelector } from './WhatsAppEmojiSelector';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import {
  fetchTrendingGifs,
  searchGifs,
  fetchTrendingStickers,
  searchStickers,
  GiphyGifItem,
  GIF_CATEGORIES,
  STICKER_CATEGORIES,
} from '../services/giphyService';
import { STICKER_PACKS, StickerItem } from '../services/stickerPacks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EmojiGifStickerPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, width?: number, height?: number) => void;
  onSelectSticker: (stickerUrl: string) => void;
}

type PickerTab = 'emoji' | 'gif' | 'sticker';

const MemoizedGifCell = React.memo<{
  item: GiphyGifItem;
  onPress: (url: string, w: number, h: number) => void;
}>(
  ({ item, onPress }) => (
    <TouchableOpacity
      onPress={() => onPress(item.originalUrl, item.width, item.height)}
      style={styles.gifItem}
    >
      <Image
        source={{ uri: item.previewUrl }}
        style={styles.gifImage}
        contentFit="cover"
        autoplay
      />
    </TouchableOpacity>
  ),
  (prev, next) => prev.item.id === next.item.id
);

const MemoizedGiphyStickerCell = React.memo<{
  item: GiphyGifItem;
  onPress: (url: string) => void;
}>(
  ({ item, onPress }) => (
    <TouchableOpacity onPress={() => onPress(item.originalUrl)} style={styles.stickerItem}>
      <Image source={{ uri: item.previewUrl }} style={styles.stickerImage} contentFit="contain" autoplay />
    </TouchableOpacity>
  ),
  (prev, next) => prev.item.id === next.item.id
);

export const EmojiGifStickerPicker: React.FC<EmojiGifStickerPickerProps> = ({
  visible,
  onClose,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
}) => {
  const [activeTab, setActiveTab] = useState<PickerTab>('emoji');

  // GIF state
  const [gifQuery, setGifQuery] = useState('');
  const [selectedGifCategoryId, setSelectedGifCategoryId] = useState('trending');
  const [gifs, setGifs] = useState<GiphyGifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Giphy Sticker state
  const [stickerQuery, setStickerQuery] = useState('');
  const [selectedStickerCategoryId, setSelectedStickerCategoryId] = useState('trending');
  const [giphyStickers, setGiphyStickers] = useState<GiphyGifItem[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [useLocalPacks, setUseLocalPacks] = useState(false);
  const [selectedPackIndex, setSelectedPackIndex] = useState(0);

  useEffect(() => {
    if (visible && activeTab === 'gif' && gifs.length === 0) {
      loadGifs('');
    } else if (visible && activeTab === 'sticker' && giphyStickers.length === 0) {
      loadStickers('');
    }
  }, [visible, activeTab]);

  const loadGifs = async (query: string) => {
    setLoadingGifs(true);
    try {
      const data = query.trim() ? await searchGifs(query) : await fetchTrendingGifs();
      setGifs(data);
    } catch (e) {
      console.error('Error loading gifs:', e);
    } finally {
      setLoadingGifs(false);
    }
  };

  const loadStickers = async (query: string) => {
    setLoadingStickers(true);
    try {
      const data = query.trim() ? await searchStickers(query) : await fetchTrendingStickers();
      setGiphyStickers(data);
    } catch (e) {
      console.error('Error loading stickers:', e);
    } finally {
      setLoadingStickers(false);
    }
  };

  const handleSelectGifCategory = (catId: string, query: string) => {
    setSelectedGifCategoryId(catId);
    setGifQuery(query);
    loadGifs(query);
  };

  const handleSelectStickerCategory = (catId: string, query: string) => {
    setSelectedStickerCategoryId(catId);
    setStickerQuery(query);
    setUseLocalPacks(false);
    loadStickers(query);
  };

  const handleGifSearchSubmit = () => {
    loadGifs(gifQuery);
  };

  const handleStickerSearchSubmit = () => {
    setUseLocalPacks(false);
    loadStickers(stickerQuery);
  };

  const renderGifItem = useCallback(
    ({ item }: { item: GiphyGifItem }) => (
      <MemoizedGifCell item={item} onPress={onSelectGif} />
    ),
    [onSelectGif]
  );

  const renderGiphyStickerItem = useCallback(
    ({ item }: { item: GiphyGifItem }) => (
      <MemoizedGiphyStickerCell item={item} onPress={onSelectSticker} />
    ),
    [onSelectSticker]
  );

  const gifKeyExtractor = useCallback((item: GiphyGifItem) => item.id, []);
  const stickerKeyExtractor = useCallback((item: GiphyGifItem) => item.id, []);

  if (!visible) return null;

  return (
    <View style={styles.sheetContainer}>
      {/* Top Header Tab Switcher */}
      <View style={styles.tabHeader}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab('emoji')}
            style={[styles.tabButton, activeTab === 'emoji' && styles.tabButtonActive]}
          >
            <Text style={styles.tabText}>😀 Emojis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('gif')}
            style={[styles.tabButton, activeTab === 'gif' && styles.tabButtonActive]}
          >
            <Text style={styles.tabText}>🎬 GIFs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('sticker')}
            style={[styles.tabButton, activeTab === 'sticker' && styles.tabButtonActive]}
          >
            <Text style={styles.tabText}>🎨 Stickers</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* TAB 1: EMOJI PICKER */}
      {activeTab === 'emoji' && (
        <View style={styles.emojiSelectorWrapper}>
          <WhatsAppEmojiSelector onEmojiSelected={onSelectEmoji} />
        </View>
      )}

      {/* TAB 2: GIF PICKER */}
      {activeTab === 'gif' && (
        <View style={styles.tabContent}>
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
            <TextInput
              placeholder="Search Giphy GIFs..."
              placeholderTextColor={COLORS.textSecondary}
              value={gifQuery}
              onChangeText={setGifQuery}
              onSubmitEditing={handleGifSearchSubmit}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {gifQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setGifQuery(''); loadGifs(''); }}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* GIF Category Pills */}
          <View style={styles.gifCategoriesPillsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifCategoryPillsContent}>
              {GIF_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleSelectGifCategory(cat.id, cat.query)}
                  style={[
                    styles.gifCategoryPill,
                    selectedGifCategoryId === cat.id && styles.gifCategoryPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.gifCategoryPillText,
                      selectedGifCategoryId === cat.id && styles.gifCategoryPillTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loadingGifs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={gifKeyExtractor}
              renderItem={renderGifItem}
              numColumns={3}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={styles.gifGridContent}
            />
          )}
        </View>
      )}

      {/* TAB 3: STICKER PICKER (Powered by Giphy Stickers API & Packs) */}
      {activeTab === 'sticker' && (
        <View style={styles.tabContent}>
          {/* Search Bar for Giphy Stickers */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} />
            <TextInput
              placeholder="Search Giphy Stickers..."
              placeholderTextColor={COLORS.textSecondary}
              value={stickerQuery}
              onChangeText={setStickerQuery}
              onSubmitEditing={handleStickerSearchSubmit}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {stickerQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setStickerQuery(''); loadStickers(''); }}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Giphy Sticker Category Pills */}
          <View style={styles.gifCategoriesPillsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifCategoryPillsContent}>
              {STICKER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleSelectStickerCategory(cat.id, cat.query)}
                  style={[
                    styles.gifCategoryPill,
                    !useLocalPacks && selectedStickerCategoryId === cat.id && styles.gifCategoryPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.gifCategoryPillText,
                      !useLocalPacks && selectedStickerCategoryId === cat.id && styles.gifCategoryPillTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loadingStickers ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={giphyStickers}
              keyExtractor={stickerKeyExtractor}
              renderItem={renderGiphyStickerItem}
              numColumns={4}
              initialNumToRender={16}
              maxToRenderPerBatch={16}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              contentContainerStyle={styles.stickerGridContent}
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    height: 310,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tabHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
  },
  tabText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  emojiSelectorWrapper: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
  },
  tabContent: {
    flex: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#03050a',
    borderRadius: 18,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 34,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginLeft: 8,
  },
  gifCategoriesPillsBar: {
    height: 32,
    marginBottom: 4,
  },
  gifCategoryPillsContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  gifCategoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  gifCategoryPillActive: {
    backgroundColor: COLORS.primary,
  },
  gifCategoryPillText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  gifCategoryPillTextActive: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gifGridContent: {
    paddingHorizontal: 8,
    gap: 6,
  },
  gifItem: {
    width: (SCREEN_WIDTH - 28) / 3,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    marginRight: 4,
    backgroundColor: '#000000',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  stickerGridContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stickerItem: {
    width: (SCREEN_WIDTH - 24) / 4,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stickerImage: {
    width: 60,
    height: 60,
  },
});
