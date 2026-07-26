import axios from 'axios';

// Loaded from environment variable (.env file) or public fallback key
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || 'vXp33S22sX13v8J0J0Y326v3Z387j';
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';
const GIPHY_STICKERS_BASE_URL = 'https://api.giphy.com/v1/stickers';

export interface GiphyGifItem {
  id: string;
  title: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
}

export const GIF_CATEGORIES = [
  { id: 'trending', name: '🔥 Trending', query: '' },
  { id: 'funny', name: '😂 Funny', query: 'funny' },
  { id: 'love', name: '❤️ Love', query: 'love' },
  { id: 'yes', name: '👍 Yes', query: 'yes thumbs up' },
  { id: 'facepalm', name: '🤦 Facepalm', query: 'facepalm' },
  { id: 'party', name: '🎉 Party', query: 'party celebration' },
  { id: 'cats', name: '🐱 Cats', query: 'cat meme' },
  { id: 'sad', name: '🥺 Moods', query: 'sad cry' },
  { id: 'hype', name: '🚀 Hype', query: 'hype dance' },
];

export const STICKER_CATEGORIES = [
  { id: 'trending', name: '🔥 Trending', query: '' },
  { id: 'love', name: '❤️ Love', query: 'love' },
  { id: 'funny', name: '😂 Reactions', query: 'reaction' },
  { id: 'cute', name: '✨ Cute', query: 'cute' },
  { id: 'party', name: '🎉 Party', query: 'party' },
  { id: 'cats', name: '🐱 Cats', query: 'cat' },
  { id: 'memes', name: '😎 Memes', query: 'meme' },
  { id: 'cool', name: '⚡️ Vibes', query: 'cool' },
];

export const fetchTrendingGifs = async (limit = 24): Promise<GiphyGifItem[]> => {
  try {
    const response = await axios.get(`${GIPHY_BASE_URL}/trending`, {
      params: {
        api_key: GIPHY_API_KEY,
        limit,
        rating: 'g',
      },
    });

    const items = formatGiphyResponse(response.data?.data);
    return items.length > 0 ? items : getFallbackGifs();
  } catch (error: any) {
    console.warn('Giphy trending fetch note: returning curated GIFs fallback.');
    return getFallbackGifs();
  }
};

export const searchGifs = async (query: string, limit = 24): Promise<GiphyGifItem[]> => {
  if (!query.trim()) return fetchTrendingGifs(limit);

  try {
    const response = await axios.get(`${GIPHY_BASE_URL}/search`, {
      params: {
        api_key: GIPHY_API_KEY,
        q: query,
        limit,
        rating: 'g',
      },
    });

    const items = formatGiphyResponse(response.data?.data);
    return items.length > 0 ? items : getFallbackGifs();
  } catch (error: any) {
    console.warn(`Giphy search note for "${query}": returning curated GIFs fallback.`);
    return getFallbackGifs();
  }
};

export const fetchTrendingStickers = async (limit = 24): Promise<GiphyGifItem[]> => {
  try {
    const response = await axios.get(`${GIPHY_STICKERS_BASE_URL}/trending`, {
      params: {
        api_key: GIPHY_API_KEY,
        limit,
        rating: 'g',
      },
    });

    const items = formatGiphyResponse(response.data?.data);
    return items.length > 0 ? items : getFallbackStickers();
  } catch (error: any) {
    console.warn('Giphy stickers trending fetch note: returning fallback stickers.');
    return getFallbackStickers();
  }
};

export const searchStickers = async (query: string, limit = 24): Promise<GiphyGifItem[]> => {
  if (!query.trim()) return fetchTrendingStickers(limit);

  try {
    const response = await axios.get(`${GIPHY_STICKERS_BASE_URL}/search`, {
      params: {
        api_key: GIPHY_API_KEY,
        q: query,
        limit,
        rating: 'g',
      },
    });

    const items = formatGiphyResponse(response.data?.data);
    return items.length > 0 ? items : getFallbackStickers();
  } catch (error: any) {
    console.warn(`Giphy sticker search note for "${query}": returning fallback stickers.`);
    return getFallbackStickers();
  }
};

const formatGiphyResponse = (data: any[]): GiphyGifItem[] => {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    const preview = item.images?.fixed_width_downsampled || item.images?.fixed_width || item.images?.preview_gif || item.images?.fixed_height_small;
    const original = item.images?.original || item.images?.downsized_large || preview;

    return {
      id: item.id || `gif_${Math.random()}`,
      title: item.title || 'Sticker',
      previewUrl: preview?.url || original?.url || '',
      originalUrl: original?.url || preview?.url || '',
      width: parseInt(original?.width || '200', 10),
      height: parseInt(original?.height || '200', 10),
    };
  });
};

const getFallbackGifs = (): GiphyGifItem[] => [
  {
    id: 'fallback_1',
    title: 'Laughing Cat',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZtNHUzbHVwZmpiaTJvZ2hndjVleGRndnljOGZidGpzbnB5a3F3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzyTuYCmvSORqs1ABM/giphy.gif',
    originalUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZtNHUzbHVwZmpiaTJvZ2hndjVleGRndnljOGZidGpzbnB5a3F3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzyTuYCmvSORqs1ABM/giphy.gif',
    width: 200,
    height: 200,
  },
  {
    id: 'fallback_2',
    title: 'Dance',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWVjcXExOGd5ZWhjMDh2dmdrYXl2dXN6M3g2bWN5d3Z4eHk5OGZveCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3V0lsG0yiETgzxXW/giphy.gif',
    originalUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNWVjcXExOGd5ZWhjMDh2dmdrYXl2dXN6M3g2bWN5d3Z4eHk5OGZveCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3V0lsG0yiETgzxXW/giphy.gif',
    width: 200,
    height: 200,
  },
  {
    id: 'fallback_3',
    title: 'Celebration',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZtNHUzbHVwZmpiaTJvZ2hndjVleGRndnljOGZidGpzbnB5a3F3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/artj92V8o75VPL7AeQ/giphy.gif',
    originalUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZtNHUzbHVwZmpiaTJvZ2hndjVleGRndnljOGZidGpzbnB5a3F3ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/artj92V8o75VPL7AeQ/giphy.gif',
    width: 200,
    height: 200,
  },
];

const getFallbackStickers = (): GiphyGifItem[] => [
  {
    id: 'stk_1',
    title: 'Fire',
    previewUrl: 'https://cdn-icons-png.flaticon.com/512/785/785116.png',
    originalUrl: 'https://cdn-icons-png.flaticon.com/512/785/785116.png',
    width: 200,
    height: 200,
  },
  {
    id: 'stk_2',
    title: 'Heart',
    previewUrl: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png',
    originalUrl: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png',
    width: 200,
    height: 200,
  },
  {
    id: 'stk_3',
    title: 'Cool Cat',
    previewUrl: 'https://cdn-icons-png.flaticon.com/512/616/616430.png',
    originalUrl: 'https://cdn-icons-png.flaticon.com/512/616/616430.png',
    width: 200,
    height: 200,
  },
  {
    id: 'stk_4',
    title: 'Rocket',
    previewUrl: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png',
    originalUrl: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png',
    width: 200,
    height: 200,
  },
];
