import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { fetchTrendingGifs, searchGifs, GiphyGifItem } from '../services/giphyService';
import { STICKER_PACKS, StickerItem } from '../services/stickerPacks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Popular categorized emojis
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙',
      '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎',
      '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨', '😤', '😠',
    ],
  },
  {
    name: 'Gestures & Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '💖', '💗', '💓', '💞', '💕', '👍', '👎', '👏', '🙌',
      '🫶', '👐', '🤲', '🤝', '🙏', '✌️', '🫰', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '🖐️', '✋', '🖖', '👋', '💪', '🧠', '🫀',
    ],
  },
  {
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🔥', '✨', '🌟', '💫', '⚡️', '🌈', '☀️', '🌤️', '⛅️', '☁️',
    ],
  },
  {
    name: 'Food & Objects',
    icon: '🍕',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🍳', '🧇', '🥞', '🧈',
      '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🍩', '🍪', '🎂', '🍰',
      '🧁', '🥧', '🍫', '🍬', '🍭', '🍺', '🍻', '🥂', '🍷', '🥃',
      '🚀', '🏆', '🎉', '🎁', '⚽️', '🏀', '🎮', '💡', '💣', '💵',
    ],
  },
];

interface EmojiGifStickerPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, width?: number, height?: number) => void;
  onSelectSticker: (stickerUrl: string) => void;
}

type PickerTab = 'emoji' | 'gif' | 'sticker';

export const EmojiGifStickerPicker: React.FC<EmojiGifStickerPickerProps> = ({
  visible,
  onClose,
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
}) => {
  const [activeTab, setActiveTab] = useState<PickerTab>('emoji');

  // Emoji state
  const [emojiSearch, setEmojiSearch] = useState('');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState(0);

  // GIF state
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  // Sticker state
  const [selectedPackIndex, setSelectedPackIndex] = useState(0);

  useEffect(() => {
    if (visible && activeTab === 'gif' && gifs.length === 0) {
      loadGifs('');
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

  const handleGifSearchSubmit = () => {
    loadGifs(gifQuery);
  };

  if (!visible) return null;

  // Filter emojis based on search
  const filteredEmojiCategories = EMOJI_CATEGORIES.map((cat) => {
    if (!emojiSearch.trim()) return cat;
    return {
      ...cat,
      emojis: cat.emojis.filter((e) => e.includes(emojiSearch.trim())),
    };
  }).filter((cat) => cat.emojis.length > 0);

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
        <View style={styles.tabContent}>
          {/* Emoji Category Sub-bar */}
          <View style={styles.categorySubBar}>
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setSelectedEmojiCategory(idx)}
                style={[
                  styles.categoryIconBtn,
                  selectedEmojiCategory === idx && styles.categoryIconBtnActive,
                ]}
              >
                <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Emoji Grid List */}
          <FlatList
            data={
              filteredEmojiCategories[selectedEmojiCategory]?.emojis ||
              EMOJI_CATEGORIES[0].emojis
            }
            keyExtractor={(item, index) => `emoji_${item}_${index}`}
            numColumns={8}
            contentContainerStyle={styles.emojiGridContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelectEmoji(item)}
                style={styles.emojiItem}
              >
                <Text style={styles.emojiText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
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

          {loadingGifs ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={styles.gifGridContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => onSelectGif(item.originalUrl, item.width, item.height)}
                  style={styles.gifItem}
                >
                  <Image
                    source={{ uri: item.previewUrl }}
                    style={styles.gifImage}
                    contentFit="cover"
                    autoplay
                  />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* TAB 3: STICKER PICKER */}
      {activeTab === 'sticker' && (
        <View style={styles.tabContent}>
          {/* Sticker Pack Tabs */}
          <View style={styles.stickerPackTabBar}>
            {STICKER_PACKS.map((pack, idx) => (
              <TouchableOpacity
                key={pack.id}
                onPress={() => setSelectedPackIndex(idx)}
                style={[
                  styles.stickerPackTabBtn,
                  selectedPackIndex === idx && styles.stickerPackTabBtnActive,
                ]}
              >
                <Text style={{ fontSize: 18 }}>{pack.icon}</Text>
                <Text
                  style={[
                    styles.stickerPackTabTitle,
                    selectedPackIndex === idx && styles.stickerPackTabTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  {pack.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stickers Grid */}
          <FlatList
            data={STICKER_PACKS[selectedPackIndex]?.stickers || []}
            keyExtractor={(item) => item.id}
            numColumns={4}
            contentContainerStyle={styles.stickerGridContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelectSticker(item.url)}
                style={styles.stickerItem}
              >
                <Image source={{ uri: item.url }} style={styles.stickerImage} contentFit="contain" />
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    height: 270,
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
  tabContent: {
    flex: 1,
  },
  categorySubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  categoryIconBtn: {
    padding: 6,
    borderRadius: 12,
  },
  categoryIconBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  emojiGridContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  emojiItem: {
    width: (SCREEN_WIDTH - 16) / 8,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#03050a',
    borderRadius: 18,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginLeft: 8,
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
    height: 100,
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
  stickerPackTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  stickerPackTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  stickerPackTabBtnActive: {
    backgroundColor: COLORS.primary,
  },
  stickerPackTabTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  stickerPackTabTitleActive: {
    color: COLORS.primaryText,
    fontWeight: '700',
  },
  stickerGridContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
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
