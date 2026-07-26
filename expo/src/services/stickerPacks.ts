export interface StickerItem {
  id: string;
  name: string;
  url: string;
}

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
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
      { id: 'react_9', name: '100 Percent', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594411.png' },
      { id: 'react_10', name: 'Explosion', url: 'https://cdn-icons-png.flaticon.com/512/1150/1150626.png' },
      { id: 'react_11', name: 'Salute', url: 'https://cdn-icons-png.flaticon.com/512/4812/4812836.png' },
      { id: 'react_12', name: 'Shocked', url: 'https://cdn-icons-png.flaticon.com/512/742/742784.png' },
    ],
  },
  {
    id: 'pack_cats',
    name: 'Kawaii Cats',
    icon: '🐱',
    stickers: [
      { id: 'cat_1', name: 'Cool Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616430.png' },
      { id: 'cat_2', name: 'Love Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616440.png' },
      { id: 'cat_3', name: 'Happy Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616434.png' },
      { id: 'cat_4', name: 'Angry Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616437.png' },
      { id: 'cat_5', name: 'Sleepy Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616432.png' },
      { id: 'cat_6', name: 'Surprised Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616438.png' },
      { id: 'cat_7', name: 'Smart Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616435.png' },
      { id: 'cat_8', name: 'Wink Cat', url: 'https://cdn-icons-png.flaticon.com/512/616/616436.png' },
      { id: 'cat_9', name: 'Cat Ninja', url: 'https://cdn-icons-png.flaticon.com/512/616/616431.png' },
      { id: 'cat_10', name: 'Cat Heart', url: 'https://cdn-icons-png.flaticon.com/512/616/616439.png' },
    ],
  },
  {
    id: 'pack_memes',
    name: 'Expressions & Memes',
    icon: '😎',
    stickers: [
      { id: 'meme_1', name: 'Rocket', url: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png' },
      { id: 'meme_2', name: 'Flex', url: 'https://cdn-icons-png.flaticon.com/512/2589/2589201.png' },
      { id: 'meme_3', name: 'Money Bag', url: 'https://cdn-icons-png.flaticon.com/512/2953/2953361.png' },
      { id: 'meme_4', name: 'Crown', url: 'https://cdn-icons-png.flaticon.com/512/2904/2904831.png' },
      { id: 'meme_5', name: 'Target', url: 'https://cdn-icons-png.flaticon.com/512/1041/1041929.png' },
      { id: 'meme_6', name: 'Brain', url: 'https://cdn-icons-png.flaticon.com/512/2491/2491338.png' },
      { id: 'meme_7', name: 'Sunglasses', url: 'https://cdn-icons-png.flaticon.com/512/1785/1785210.png' },
      { id: 'meme_8', name: 'Trophy', url: 'https://cdn-icons-png.flaticon.com/512/3112/3112946.png' },
      { id: 'meme_9', name: 'Diamond', url: 'https://cdn-icons-png.flaticon.com/512/2904/2904975.png' },
      { id: 'meme_10', name: 'Lightning', url: 'https://cdn-icons-png.flaticon.com/512/936/936449.png' },
    ],
  },
  {
    id: 'pack_love',
    name: 'Love & Hearts',
    icon: '💖',
    stickers: [
      { id: 'love_1', name: 'Sparkle Heart', url: 'https://cdn-icons-png.flaticon.com/512/2589/2589175.png' },
      { id: 'love_2', name: 'Heart Arrow', url: 'https://cdn-icons-png.flaticon.com/512/1077/1077035.png' },
      { id: 'love_3', name: 'Love Letter', url: 'https://cdn-icons-png.flaticon.com/512/1077/1077042.png' },
      { id: 'love_4', name: 'Teddy Bear', url: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png' },
      { id: 'love_5', name: 'Rose', url: 'https://cdn-icons-png.flaticon.com/512/744/744530.png' },
      { id: 'love_6', name: 'Kiss', url: 'https://cdn-icons-png.flaticon.com/512/742/742752.png' },
      { id: 'love_7', name: 'Two Hearts', url: 'https://cdn-icons-png.flaticon.com/512/1077/1077086.png' },
      { id: 'love_8', name: 'Cupid', url: 'https://cdn-icons-png.flaticon.com/512/1077/1077067.png' },
    ],
  },
  {
    id: 'pack_food',
    name: 'Food & Drinks',
    icon: '🍕',
    stickers: [
      { id: 'food_1', name: 'Pizza', url: 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png' },
      { id: 'food_2', name: 'Burger', url: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png' },
      { id: 'food_3', name: 'Doughnut', url: 'https://cdn-icons-png.flaticon.com/512/3075/3075935.png' },
      { id: 'food_4', name: 'Coffee', url: 'https://cdn-icons-png.flaticon.com/512/3054/3054889.png' },
      { id: 'food_5', name: 'Popcorn', url: 'https://cdn-icons-png.flaticon.com/512/3595/3595458.png' },
      { id: 'food_6', name: 'Ice Cream', url: 'https://cdn-icons-png.flaticon.com/512/3075/3075973.png' },
      { id: 'food_7', name: 'Taco', url: 'https://cdn-icons-png.flaticon.com/512/3595/3595460.png' },
      { id: 'food_8', name: 'Beer Cheers', url: 'https://cdn-icons-png.flaticon.com/512/2833/2833631.png' },
    ],
  },
  {
    id: 'pack_sports',
    name: 'Gaming & Sports',
    icon: '🎮',
    stickers: [
      { id: 'game_1', name: 'Gamepad', url: 'https://cdn-icons-png.flaticon.com/512/808/808489.png' },
      { id: 'game_2', name: 'Soccer', url: 'https://cdn-icons-png.flaticon.com/512/1165/1165187.png' },
      { id: 'game_3', name: 'Basketball', url: 'https://cdn-icons-png.flaticon.com/512/889/889455.png' },
      { id: 'game_4', name: 'VR Goggles', url: 'https://cdn-icons-png.flaticon.com/512/1041/1041893.png' },
      { id: 'game_5', name: 'Gold Medal', url: 'https://cdn-icons-png.flaticon.com/512/2583/2583344.png' },
      { id: 'game_6', name: 'Joystick', url: 'https://cdn-icons-png.flaticon.com/512/1041/1041897.png' },
    ],
  },
  {
    id: 'pack_party',
    name: 'Party & Celebration',
    icon: '🎉',
    stickers: [
      { id: 'party_1', name: 'Confetti', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594406.png' },
      { id: 'party_2', name: 'Birthday Cake', url: 'https://cdn-icons-png.flaticon.com/512/2682/2682446.png' },
      { id: 'party_3', name: 'Balloons', url: 'https://cdn-icons-png.flaticon.com/512/3132/3132693.png' },
      { id: 'party_4', name: 'Fireworks', url: 'https://cdn-icons-png.flaticon.com/512/1150/1150608.png' },
      { id: 'party_5', name: 'Music Notes', url: 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png' },
    ],
  },
  {
    id: 'pack_bubbles',
    name: 'Bubble Words',
    icon: '💬',
    stickers: [
      { id: 'bub_1', name: 'WOW', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594420.png' },
      { id: 'bub_2', name: 'OMG', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594422.png' },
      { id: 'bub_3', name: 'LOL', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594415.png' },
      { id: 'bub_4', name: 'COOL', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594418.png' },
      { id: 'bub_5', name: 'YES', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594425.png' },
      { id: 'bub_6', name: 'NO', url: 'https://cdn-icons-png.flaticon.com/512/3594/3594427.png' },
    ],
  },
];
