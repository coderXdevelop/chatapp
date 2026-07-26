import axios from 'axios';

// Loaded from environment variable (.env file) or public fallback key
const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || 'vXp33S22sX13v8J0J0Y326v3Z387j';
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

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

const formatGiphyResponse = (data: any[]): GiphyGifItem[] => {
  if (!Array.isArray(data)) return [];

  return data.map((item) => {
    const preview = item.images?.fixed_width_downsampled || item.images?.preview_gif || item.images?.fixed_height_small;
    const original = item.images?.original || item.images?.downsized_large || preview;

    return {
      id: item.id || `gif_${Math.random()}`,
      title: item.title || 'GIF',
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
