export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const TILE_SIZE = 32;
export const PLAYER_SPEED = 150;
export const NPC_SPEED = 60;
export const INTERACTION_DISTANCE = 50;
export const DAY_LENGTH_MS = 120000; // 2 minutes = 1 game day

export const COLORS = {
  player: 0x4488ff,
  grass: 0x3a7d44,
  path: 0xc4a35a,
  water: 0x2980b9,
  building: 0x8b7355,
  forge: 0xcc4400,
  inn: 0xbb8844,
  market: 0x6644aa,
  farm: 0x558833,
  guardPost: 0x666688,
  herbShop: 0x339966,
};

export const NPC_COLORS: Record<string, number> = {
  blacksmith_erik: 0xcc4400,
  innkeeper_rose: 0xdd6699,
  merchant_anna: 0x9944cc,
  farmer_thomas: 0x558833,
  guard_marcus: 0x667788,
  herbalist_willow: 0x33aa66,
};
