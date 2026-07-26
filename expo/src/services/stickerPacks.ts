export interface StickerItem {
  id: string;
  name: string;
  url: string;
}

export interface StickerPack {
  id: string;
  name: string;
  icon: string; // Emoji representation of category
  stickers: StickerItem[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'pack_reactions',
    name: 'Reactions',
    icon: '🔥',
    stickers: [
      { id: 'react_1', name: 'Fire', url: 'https://cdn-icons-png.flaticon.com/512/785/785116.png' },
      { id: 'react_2', name: 'Heart', url: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png' },
      { id: 'react_3', name: 'Thumbs Up', url: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png' },
      { id: 'react_4', name: 'Clap', url: 'https://cdn-icons-png.flaticon.com/512/1041/1041926.png' },
      { id: 'react_5', name: 'Laughing', url: 'https://cdn-icons-png.flaticon.com/512/742/742751.png' },
      { id: 'react_6', name: 'Party Popper', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594406.png' },
      { id: 'react_7', name: 'Star Eyes', url: 'https://cdn-icons-png.flaticon.com/512/742/742920.png' },
      { id: 'react_8', name: 'Mind Blown', url: 'https://cdn-icons-png.flaticon.com/512/742/742808.png' },
    ],
  },
  {
    id: 'pack_cats',
    name: 'Expressive Cats',
    icon: '🐱',
    stickers: [
      { id: 'cat_1', name: 'Cool Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616430.png' },
      { id: 'cat_2', name: 'Love Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616440.png' },
      { id: 'cat_3', name: 'Happy Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616434.png' },
      { id: 'cat_4', name: 'Angry Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616437.png' },
      { id: 'cat_5', name: 'Sleepy Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616432.png' },
      { id: 'cat_6', name: 'Surprised Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616438.png' },
    ],
  },
  {
    id: 'pack_memes',
    name: 'Popular Expressions',
    icon: '😎',
    stickers: [
      { id: 'meme_1', name: 'Rocket', url: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png' },
      { id: 'meme_2', name: 'Flex', url: 'https://cdn-icons-png.flaticon.com/512/2589/2589201.png' },
      { id: 'meme_3', name: 'Money Bag', url: 'https://cdn-icons-png.flaticon.com/512/2953/2953361.png' },
      { id: 'meme_4', name: 'Crown', url: 'https://cdn-icons-png.flaticon.com/512/2904/2904831.png' },
      { id: 'meme_5', name: 'Target', url: 'https://cdn-icons-png.flaticon.com/512/1041/1041929.png' },
      { id: 'meme_6', name: '100 Score', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594411.png' },
    ],
  },
];
