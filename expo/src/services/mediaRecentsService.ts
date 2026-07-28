import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_RECENTS = 6;

export interface RecentGifItem {
  id: string;
  url: string;
  previewUrl: string;
  width?: number;
  height?: number;
}

export interface RecentStickerItem {
  id: string;
  url: string;
  previewUrl: string;
  name?: string;
}

const RECENT_STICKERS_KEY = '@chatconnect_recent_stickers_v1';
const RECENT_GIFS_KEY = '@chatconnect_recent_gifs_v1';
const RECENT_EMOJIS_KEY = '@chatconnect_recent_emojis_v1';
const FAVORITE_STICKERS_KEY = '@chatconnect_favorite_stickers_v1';

// --- STICKERS RECENTS ---
export async function getRecentStickers(): Promise<RecentStickerItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STICKERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load recent stickers:', e);
    return [];
  }
}

export async function addRecentSticker(
  stickerUrl: string,
  previewUrl?: string,
  name?: string
): Promise<RecentStickerItem[]> {
  try {
    const existing = await getRecentStickers();
    const cleanUrl = stickerUrl.trim();
    const item: RecentStickerItem = {
      id: `rec_stk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: cleanUrl,
      previewUrl: previewUrl || cleanUrl,
      name: name || 'Sticker',
    };

    const filtered = existing.filter((s) => s.url !== cleanUrl);
    const updated = [item, ...filtered].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save recent sticker:', e);
    return [];
  }
}

// --- GIFS RECENTS ---
export async function getRecentGifs(): Promise<RecentGifItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_GIFS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load recent gifs:', e);
    return [];
  }
}

export async function addRecentGif(gif: {
  id?: string;
  url: string;
  previewUrl?: string;
  width?: number;
  height?: number;
}): Promise<RecentGifItem[]> {
  try {
    const existing = await getRecentGifs();
    const cleanUrl = gif.url.trim();
    const item: RecentGifItem = {
      id: gif.id || `rec_gif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: cleanUrl,
      previewUrl: gif.previewUrl || cleanUrl,
      width: gif.width,
      height: gif.height,
    };

    const filtered = existing.filter((g) => g.url !== cleanUrl);
    const updated = [item, ...filtered].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENT_GIFS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save recent gif:', e);
    return [];
  }
}

// --- EMOJIS RECENTS ---
export async function getRecentEmojis(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_EMOJIS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load recent emojis:', e);
    return [];
  }
}

export async function addRecentEmoji(emoji: string): Promise<string[]> {
  try {
    const existing = await getRecentEmojis();
    const cleanEmoji = emoji.trim();
    if (!cleanEmoji) return existing;

    const filtered = existing.filter((e) => e !== cleanEmoji);
    const updated = [cleanEmoji, ...filtered].slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save recent emoji:', e);
    return [];
  }
}

// --- FAVORITE STICKERS ---
export async function getFavoriteStickers(): Promise<RecentStickerItem[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_STICKERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load favorite stickers:', e);
    return [];
  }
}

export async function toggleFavoriteSticker(
  stickerUrl: string,
  previewUrl?: string,
  name?: string
): Promise<{ favorites: RecentStickerItem[]; isFavorite: boolean }> {
  try {
    const existing = await getFavoriteStickers();
    const cleanUrl = stickerUrl.trim();
    const alreadyFav = existing.some((s) => s.url === cleanUrl);

    let updated: RecentStickerItem[];
    if (alreadyFav) {
      updated = existing.filter((s) => s.url !== cleanUrl);
    } else {
      const item: RecentStickerItem = {
        id: `fav_stk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url: cleanUrl,
        previewUrl: previewUrl || cleanUrl,
        name: name || 'Sticker',
      };
      updated = [item, ...existing];
    }

    await AsyncStorage.setItem(FAVORITE_STICKERS_KEY, JSON.stringify(updated));
    return { favorites: updated, isFavorite: !alreadyFav };
  } catch (e) {
    console.warn('Failed to toggle favorite sticker:', e);
    return { favorites: [], isFavorite: false };
  }
}

export function isStickerFavorite(
  stickerUrl: string,
  favoritesList: RecentStickerItem[]
): boolean {
  if (!stickerUrl || !favoritesList) return false;
  const cleanUrl = stickerUrl.trim();
  return favoritesList.some((s) => s.url === cleanUrl);
}
