import emojiGroupData from 'unicode-emoji-json/data-by-group.json';

export interface EmojiItem {
  emoji: string;
  name: string;
  keywords: string;
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiItem[];
}

const CATEGORY_ICONS: Record<string, string> = {
  'smileys_emotion': '😀',
  'people_body': '👋',
  'animals_nature': '🐶',
  'food_drink': '🍕',
  'travel_places': '✈️',
  'activities': '⚽️',
  'objects': '💡',
  'symbols': '🔣',
  'flags': '🚩',
  'component': '🎨',
};

export const ALL_EMOJI_CATEGORIES: EmojiCategory[] = (emojiGroupData as any[])
  .filter((group) => group.slug !== 'component')
  .map((group) => ({
    id: group.slug,
    name: group.name,
    icon: CATEGORY_ICONS[group.slug] || '😀',
    emojis: group.emojis.map((e: any) => ({
      emoji: e.emoji,
      name: e.name || '',
      keywords: `${e.name || ''} ${e.slug || ''}`.toLowerCase(),
    })),
  }));
