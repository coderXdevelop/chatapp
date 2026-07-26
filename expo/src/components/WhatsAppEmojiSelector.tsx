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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EMOJI_HISTORY_KEY = '@chatconnect_emoji_history';

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_DATA: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & People',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
      '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙',
      '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎',
      '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥',
      '😓', '🫣', '🤗', '🫡', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures & Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '💖', '💗', '💓', '💞', '💕', '❣', '💘', '💝',
      '👍', '👎', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✌️',
      '🫰', '🤙', '👈', '👉', '👆', '👇', '☝️', '🖐️', '✋', '🖖',
      '👋', '💪', '🧠', '🫀', '🫁', '👀', '👁️', '👄', '🫦', '👅',
    ],
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
      '🔥', '✨', '🌟', '💫', '⚡️', '🌈', '☀️', '🌤️', '⛅️', '☁️',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🍳', '🧇', '🥞', '🧈',
      '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🍩', '🍪', '🎂', '🍰',
      '🧁', '🥧', '🍫', '🍬', '🍭', '🍺', '🍻', '🥂', '🍷', '🥃',
      '🍸', '🍹', '🧉', '🍾', '🥤', '🧋', '🧃', '☕️', '🍵', '🍶',
    ],
  },
  {
    id: 'activities',
    name: 'Activities & Sports',
    icon: '⚽️',
    emojis: [
      '⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳️',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '🎯', '🎮', '🕹️', '🎰', '🎲', '🧩', '🎨', '🎬', '🎤', '🎧',
    ],
  },
  {
    id: 'objects',
    name: 'Objects & Tech',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🏮', '🪔', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️',
      '🖱️', '🕹️', '💽', '💾', '💿', '📀', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
      '💣', '📜', '📄', '📅', '📊', '📈', '📉', '📌', '📍', '💵',
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols & Flags',
    icon: '🚩',
    emojis: [
      '💯', '♨️', '💬', '👁️‍🗨️', '🗯️', '💭', '💤', '🌐', '♠️', '♥️',
      '♦️', '♣️', '🃏', '🀄️', '🎴', '🔔', '🔕', '📢', '📣', '🔍',
      '🔎', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝️', '🔨', '🪓', '⛏️',
      '🚩', '🏳️', '🏴', '🏴‍☠️', '🏁', '🇮🇳', '🇺🇸', '🇬🇧', '🇯🇵', '🇫🇷',
    ],
  },
];

interface WhatsAppEmojiSelectorProps {
  onEmojiSelected: (emoji: string) => void;
}

export const WhatsAppEmojiSelector: React.FC<WhatsAppEmojiSelectorProps> = ({
  onEmojiSelected,
}) => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>('smileys');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

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

  const handleEmojiPress = async (emoji: string) => {
    onEmojiSelected(emoji);

    try {
      const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(0, 32);
      setRecentEmojis(updated);
      await AsyncStorage.setItem(EMOJI_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save emoji history:', e);
    }
  };

  const displayCategories = useMemo(() => {
    const categoriesList: { id: string; name: string; icon: string; emojis: string[] }[] = [];

    if (recentEmojis.length > 0 && !searchQuery.trim()) {
      categoriesList.push({
        id: 'recent',
        name: 'Recently Used',
        icon: '🕒',
        emojis: recentEmojis,
      });
    }

    EMOJI_DATA.forEach((cat) => {
      if (!searchQuery.trim()) {
        categoriesList.push(cat);
      } else {
        const filtered = cat.emojis.filter((e) => e.includes(searchQuery.trim()));
        if (filtered.length > 0) {
          categoriesList.push({
            ...cat,
            emojis: filtered,
          });
        }
      }
    });

    return categoriesList;
  }, [recentEmojis, searchQuery]);

  const activeCategoryIndex = displayCategories.findIndex((c) => c.id === activeCategoryId);
  const currentCategory = displayCategories[activeCategoryIndex >= 0 ? activeCategoryIndex : 0] || displayCategories[0];

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={16} color={COLORS.textSecondary} />
        <TextInput
          placeholder="Search emoji..."
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
              (activeCategoryId === cat.id || (activeCategoryId === 'smileys' && cat.id === 'smileys')) &&
                styles.categoryIconBtnActive,
            ]}
          >
            <Text style={styles.categoryIconText}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Emoji Grid List */}
      <FlatList
        data={currentCategory?.emojis || []}
        keyExtractor={(item, index) => `emoji_${item}_${index}`}
        numColumns={8}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.emojiGridContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleEmojiPress(item)}
            style={styles.emojiItem}
            activeOpacity={0.6}
          >
            <Text style={styles.emojiText}>{item}</Text>
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryIconBtnActive: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
  },
  categoryIconText: {
    fontSize: 18,
  },
  emojiGridContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
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
