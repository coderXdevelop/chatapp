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
import {
  getRecentStickers,
  addRecentSticker,
  getRecentGifs,
  addRecentGif,
  addRecentEmoji,
  getFavoriteStickers,
  toggleFavoriteSticker,
  isStickerFavorite,
  RecentStickerItem,
  RecentGifItem,
} from '../services/mediaRecentsService';

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
MemoizedGifCell.displayName = 'MemoizedGifCell';

const MemoizedGiphyStickerCell = React.memo<{
  item: GiphyGifItem;
  onPress: (url: string) => void;
  isFav?: boolean;
  onToggleFav?: (url: string, previewUrl?: string) => void;
}>(
  ({ item, onPress, isFav, onToggleFav }) => (
    <View style={styles.stickerItemWrapper}>
      <TouchableOpacity onPress={() => onPress(item.originalUrl)} style={styles.stickerItem}>
        <Image
          source={{ uri: item.previewUrl }}
          style={styles.stickerImage}
          contentFit="contain"
          autoplay
        />
      </TouchableOpacity>
      {onToggleFav && (
        <TouchableOpacity
          style={styles.favBadgeBtn}
          onPress={() => onToggleFav(item.originalUrl, item.previewUrl)}
        >
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={16}
            color={isFav ? '#F59E0B' : '#9CA3AF'}
          />
        </TouchableOpacity>
      )}
    </View>
  ),
  (prev, next) => prev.item.id === next.item.id && prev.isFav === next.isFav
);
MemoizedGiphyStickerCell.displayName = 'MemoizedGiphyStickerCell';

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

  // Sticker state
  const [stickerQuery, setStickerQuery] = useState('');
  const [selectedStickerCategoryId, setSelectedStickerCategoryId] = useState('favorites');
  const [giphyStickers, setGiphyStickers] = useState<GiphyGifItem[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);

  // Recents & Favorites state
  const [favoriteStickers, setFavoriteStickers] = useState<RecentStickerItem[]>([]);
  const [recentStickers, setRecentStickers] = useState<RecentStickerItem[]>([]);
  const [recentGifs, setRecentGifs] = useState<RecentGifItem[]>([]);

  const loadMediaRecentsAndFavorites = async () => {
    try {
      const [favs, recStk, recGifs] = await Promise.all([
        getFavoriteStickers(),
        getRecentStickers(),
        getRecentGifs(),
      ]);
      setFavoriteStickers(favs);
      setRecentStickers(recStk);
      setRecentGifs(recGifs);
    } catch (e) {
      console.warn('Error loading media recents/favorites:', e);
    }
  };

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

  useEffect(() => {
    if (visible) {
      loadMediaRecentsAndFavorites();
      if (activeTab === 'gif' && gifs.length === 0 && selectedGifCategoryId !== 'recent') {
        loadGifs('');
      } else if (
        activeTab === 'sticker' &&
        giphyStickers.length === 0 &&
        selectedStickerCategoryId !== 'favorites' &&
        selectedStickerCategoryId !== 'recents'
      ) {
        loadStickers('');
      }
    }
  }, [visible, activeTab]);

  const handleSelectGifCategory = (catId: string, query: string) => {
    setSelectedGifCategoryId(catId);
    setGifQuery(query);
    if (catId !== 'recent') {
      loadGifs(query);
    }
  };

  const handleSelectStickerCategory = (catId: string, query: string) => {
    setSelectedStickerCategoryId(catId);
    setStickerQuery(query);
    if (catId !== 'favorites' && catId !== 'recents') {
      loadStickers(query);
    }
  };

  const handleGifSearchSubmit = () => {
    if (selectedGifCategoryId === 'recent') {
      setSelectedGifCategoryId('trending');
    }
    loadGifs(gifQuery);
  };

  const handleStickerSearchSubmit = () => {
    if (selectedStickerCategoryId === 'favorites' || selectedStickerCategoryId === 'recents') {
      setSelectedStickerCategoryId('trending');
    }
    loadStickers(stickerQuery);
  };

  const handleEmojiSelectInternal = async (emoji: string) => {
    try {
      await addRecentEmoji(emoji);
    } catch (e) {
      console.warn('Failed to record recent emoji:', e);
    }
    onSelectEmoji(emoji);
  };

  const handleGifSelectInternal = async (url: string, w: number, h: number) => {
    try {
      const updated = await addRecentGif({ url, previewUrl: url, width: w, height: h });
      setRecentGifs(updated);
    } catch (e) {
      console.warn('Failed to record recent GIF:', e);
    }
    onSelectGif(url, w, h);
  };

  const handleStickerSelectInternal = async (url: string) => {
    try {
      const updated = await addRecentSticker(url, url);
      setRecentStickers(updated);
    } catch (e) {
      console.warn('Failed to record recent sticker:', e);
    }
    onSelectSticker(url);
  };

  const handleToggleFavoriteSticker = async (url: string, previewUrl?: string) => {
    try {
      const result = await toggleFavoriteSticker(url, previewUrl);
      setFavoriteStickers(result.favorites);
    } catch (e) {
      console.warn('Failed to toggle sticker favorite:', e);
    }
  };

  const renderGifItem = useCallback(
    ({ item }: { item: GiphyGifItem }) => (
      <MemoizedGifCell item={item} onPress={handleGifSelectInternal} />
    ),
    [handleGifSelectInternal]
  );

  const renderGiphyStickerItem = useCallback(
    ({ item }: { item: GiphyGifItem }) => {
      const isFav = isStickerFavorite(item.originalUrl, favoriteStickers);
      return (
        <MemoizedGiphyStickerCell
          item={item}
          onPress={handleStickerSelectInternal}
          isFav={isFav}
          onToggleFav={handleToggleFavoriteSticker}
        />
      );
    },
    [favoriteStickers, handleStickerSelectInternal]
  );

  const gifKeyExtractor = useCallback((item: GiphyGifItem) => item.id, []);
  const stickerKeyExtractor = useCallback((item: GiphyGifItem) => item.id, []);

  // Map Recents/Favorites into GiphyGifItem format for uniform rendering
  const displayedStickers: GiphyGifItem[] = React.useMemo(() => {
    if (selectedStickerCategoryId === 'favorites') {
      return favoriteStickers.map((s) => ({
        id: s.id,
        title: s.name || 'Favorite Sticker',
        previewUrl: s.previewUrl || s.url,
        originalUrl: s.url,
        width: 120,
        height: 120,
      }));
    }
    if (selectedStickerCategoryId === 'recents') {
      return recentStickers.map((s) => ({
        id: s.id,
        title: s.name || 'Recent Sticker',
        previewUrl: s.previewUrl || s.url,
        originalUrl: s.url,
        width: 120,
        height: 120,
      }));
    }
    return giphyStickers;
  }, [selectedStickerCategoryId, favoriteStickers, recentStickers, giphyStickers]);

  const displayedGifs: GiphyGifItem[] = React.useMemo(() => {
    if (selectedGifCategoryId === 'recent') {
      return recentGifs.map((g) => ({
        id: g.id,
        title: 'Recent GIF',
        previewUrl: g.previewUrl || g.url,
        originalUrl: g.url,
        width: g.width || 200,
        height: g.height || 180,
      }));
    }
    return gifs;
  }, [selectedGifCategoryId, recentGifs, gifs]);

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
            onPress={() => {
              setActiveTab('gif');
              if (gifs.length === 0 && selectedGifCategoryId !== 'recent') loadGifs('');
            }}
            style={[styles.tabButton, activeTab === 'gif' && styles.tabButtonActive]}
          >
            <Text style={styles.tabText}>🎬 GIFs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setActiveTab('sticker');
              if (
                giphyStickers.length === 0 &&
                selectedStickerCategoryId !== 'favorites' &&
                selectedStickerCategoryId !== 'recents'
              ) {
                loadStickers('');
              }
            }}
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
          <WhatsAppEmojiSelector onEmojiSelected={handleEmojiSelectInternal} />
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
              <TouchableOpacity
                onPress={() => setSelectedGifCategoryId('recent')}
                style={[
                  styles.gifCategoryPill,
                  selectedGifCategoryId === 'recent' && styles.gifCategoryPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.gifCategoryPillText,
                    selectedGifCategoryId === 'recent' && styles.gifCategoryPillTextActive,
                  ]}
                >
                  🕒 Recent
                </Text>
              </TouchableOpacity>

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

          {loadingGifs && selectedGifCategoryId !== 'recent' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : selectedGifCategoryId === 'recent' && displayedGifs.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="time-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Recent GIFs</Text>
              <Text style={styles.emptyStateSub}>GIFs you send will appear here (up to 6).</Text>
            </View>
          ) : (
            <FlatList
              data={displayedGifs}
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

      {/* TAB 3: STICKER PICKER (Powered by Favorites, Recents & Giphy Stickers API) */}
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

          {/* Sticker Category Pills: Favorites, Recents, Trending, & Categories */}
          <View style={styles.gifCategoriesPillsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gifCategoryPillsContent}>
              <TouchableOpacity
                onPress={() => setSelectedStickerCategoryId('favorites')}
                style={[
                  styles.gifCategoryPill,
                  selectedStickerCategoryId === 'favorites' && styles.gifCategoryPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.gifCategoryPillText,
                    selectedStickerCategoryId === 'favorites' && styles.gifCategoryPillTextActive,
                  ]}
                >
                  ⭐ Favorites ({favoriteStickers.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedStickerCategoryId('recents')}
                style={[
                  styles.gifCategoryPill,
                  selectedStickerCategoryId === 'recents' && styles.gifCategoryPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.gifCategoryPillText,
                    selectedStickerCategoryId === 'recents' && styles.gifCategoryPillTextActive,
                  ]}
                >
                  🕒 Recent
                </Text>
              </TouchableOpacity>

              {STICKER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleSelectStickerCategory(cat.id, cat.query)}
                  style={[
                    styles.gifCategoryPill,
                    selectedStickerCategoryId === cat.id && styles.gifCategoryPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.gifCategoryPillText,
                      selectedStickerCategoryId === cat.id && styles.gifCategoryPillTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loadingStickers && selectedStickerCategoryId !== 'favorites' && selectedStickerCategoryId !== 'recents' ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : selectedStickerCategoryId === 'favorites' && displayedStickers.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="star-outline" size={32} color="#FFD700" />
              <Text style={styles.emptyStateTitle}>No Favorite Stickers Yet</Text>
              <Text style={styles.emptyStateSub}>
                Tap the ⭐ icon on any sticker to add it to your favorites for quick access.
              </Text>
            </View>
          ) : selectedStickerCategoryId === 'recents' && displayedStickers.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="time-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateTitle}>No Recent Stickers</Text>
              <Text style={styles.emptyStateSub}>Stickers you send will appear here (up to 6).</Text>
            </View>
          ) : (
            <FlatList
              data={displayedStickers}
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyStateSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
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
  stickerItemWrapper: {
    width: (SCREEN_WIDTH - 24) / 4,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  stickerItem: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerImage: {
    width: 56,
    height: 56,
  },
  favBadgeBtn: {
    position: 'absolute',
    top: 2,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 10,
    padding: 3,
    zIndex: 10,
  },
});
