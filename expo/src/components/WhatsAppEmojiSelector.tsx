import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { ALL_EMOJI_CATEGORIES, EmojiItem, EmojiCategory } from '../services/emojiDataset';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMOJI_HISTORY_KEY = '@chatconnect_emoji_history_v2';

interface WhatsAppEmojiSelectorProps {
  onEmojiSelected: (emoji: string) => void;
}

export const WhatsAppEmojiSelector: React.FC<WhatsAppEmojiSelectorProps> = ({
  onEmojiSelected,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('smileys_emotion');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentEmojis, setRecentEmojis] = useState<EmojiItem[]>([]);

  useEffect(() => {
    loadRecentEmojis();
  }, []);

  const loadRecentEmojis = async () => {
    try {
      const stored = await AsyncStorage.getItem(EMOJI_HISTORY_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load emoji history:', e);
    }
  };

  const handleEmojiPress = async (item: EmojiItem) => {
    onEmojiSelected(item.emoji);

    try {
      const updated = [item, ...recentEmojis.filter((e) => e.emoji !== item.emoji)].slice(0, 32);
      setRecentEmojis(updated);
      await AsyncStorage.setItem(EMOJI_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save emoji history:', e);
    }
  };

  const displayCategories = useMemo(() => {
    const list: EmojiCategory[] = [];

    if (recentEmojis.length > 0 && !searchQuery.trim()) {
      list.push({
        id: 'recent',
        name: 'Recently Used',
        icon: '🕒',
        emojis: recentEmojis,
      });
    }

    const query = searchQuery.trim().toLowerCase();

    ALL_EMOJI_CATEGORIES.forEach((cat) => {
      if (!query) {
        list.push(cat);
      } else {
        const filtered = cat.emojis.filter((e) => e.keywords.includes(query) || e.name.toLowerCase().includes(query));
        if (filtered.length > 0) {
          list.push({
            ...cat,
            emojis: filtered,
          });
        }
      }
    });

    return list;
  }, [recentEmojis, searchQuery]);

  const activeCategoryIndex = displayCategories.findIndex((c) => c.id === activeCategoryId);
  const currentCategory = displayCategories[activeCategoryIndex >= 0 ? activeCategoryIndex : 0] || displayCategories[0];

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          placeholder="Search all 1,800+ emojis..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Icons Navigation Bar */}
      <View style={styles.categorySubBar}>
        {displayCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setActiveCategoryId(cat.id)}
            style={[
              styles.categoryIconBtn,
              (activeCategoryId === cat.id || (activeCategoryId === 'smileys_emotion' && cat.id === 'smileys_emotion')) &&
                styles.categoryIconBtnActive,
            ]}
          >
            <Text style={styles.categoryIconText}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Title Banner */}
      <View style={styles.categoryTitleContainer}>
        <Text style={styles.categoryTitleText}>{currentCategory?.name || 'Emojis'}</Text>
      </View>

      {/* Complete 1,800+ Emoji Grid List */}
      <FlatList
        data={currentCategory?.emojis || []}
        keyExtractor={(item, index) => `emoji_${item.emoji}_${index}`}
        numColumns={8}
        showsVerticalScrollIndicator={false}
        initialNumToRender={40}
        maxToRenderPerBatch={40}
        windowSize={11}
        contentContainerStyle={styles.emojiGridContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleEmojiPress(item)}
            style={styles.emojiItem}
            activeOpacity={0.6}
          >
            <Text style={styles.emojiText}>{item.emoji}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#03050a',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 32,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginLeft: 6,
  },
  categorySubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryIconBtnActive: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
  },
  categoryIconText: {
    fontSize: 18,
  },
  categoryTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  categoryTitleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emojiGridContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emojiItem: {
    width: (SCREEN_WIDTH - 16) / 8,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 22,
  },
});
