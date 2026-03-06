export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 960;
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

export const BUILDING_COLLISION_PADDING = 0.85;

// Combat constants
export const ATTACK_COOLDOWN_MS = 500;
export const ATTACK_RANGE = TILE_SIZE;
export const PLAYER_MAX_HEALTH = 100;
export const INVINCIBILITY_MS = 250;

export const GOSSIP_RANGE = TILE_SIZE * 4;
export const GOSSIP_INTERVAL_MS = 10000;

// Blight constants
export const BLIGHT_BASE_INTENSITY = 0.1;
export const BLIGHT_DAILY_INCREASE = 0.02;
export const BLIGHT_OVERLAY_DEPTH = 30;

export const NPC_COLORS: Record<string, number> = {
  blacksmith_erik: 0xcc4400,
  innkeeper_rose: 0xdd6699,
  merchant_anna: 0x9944cc,
  farmer_thomas: 0x558833,
  guard_marcus: 0x667788,
  herbalist_willow: 0x33aa66,
};

export const FONT_SCALE_OPTIONS = {
  small: 0.6,
  medium: 1.0,
  large: 1.4,
} as const;

export type FontScaleKey = keyof typeof FONT_SCALE_OPTIONS;

export function getFontScale(): number {
  const key = (localStorage.getItem('font_scale') || 'medium') as FontScaleKey;
  return FONT_SCALE_OPTIONS[key] ?? 1.0;
}

export function fs(baseSize: number): string {
  return `${Math.round(baseSize * getFontScale())}px`;
}

export function fsn(baseSize: number): number {
  return Math.round(baseSize * getFontScale());
}
