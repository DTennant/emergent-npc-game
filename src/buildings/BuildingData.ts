import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';

export interface FurnitureDef {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  label?: string;
}

export interface BuildingInterior {
  id: string;
  name: string;
  npcId: string;
  bgColor: number;
  floorColor: number;
  wallColor: number;
  spawnPoint: { x: number; y: number };
  npcPosition: { x: number; y: number };
  doorPosition: { x: number; y: number };
  furniture: FurnitureDef[];
}

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const T = TILE_SIZE;

export const BUILDING_INTERIORS: BuildingInterior[] = [
  {
    id: 'forge',
    name: 'Erik\'s Forge',
    npcId: 'blacksmith_erik',
    bgColor: 0x1a0f0a,
    floorColor: 0x3a2a1a,
    wallColor: 0x4a3020,
    spawnPoint: { x: W / 2, y: H - T * 3 },
    npcPosition: { x: W / 2, y: H / 2 - T * 2 },
    doorPosition: { x: W / 2, y: H - T * 1.5 },
    furniture: [
      { x: W / 2 - T * 4, y: T * 3, w: T * 3, h: T * 2, color: 0x882200, label: 'Anvil' },
      { x: W / 2 + T * 2, y: T * 3, w: T * 2, h: T * 3, color: 0xcc3300, label: 'Furnace' },
      { x: T * 2, y: H / 2, w: T * 2, h: T, color: 0x555544, label: 'Workbench' },
      { x: W - T * 4, y: H / 2, w: T * 2, h: T * 4, color: 0x443322, label: 'Tool Rack' },
      { x: T * 2, y: H / 2 + T * 3, w: T * 3, h: T, color: 0x444444, label: 'Storage' },
    ],
  },
  {
    id: 'inn',
    name: 'Thornwick Inn',
    npcId: 'innkeeper_rose',
    bgColor: 0x1a1408,
    floorColor: 0x4a3828,
    wallColor: 0x5a4030,
    spawnPoint: { x: W / 2, y: H - T * 3 },
    npcPosition: { x: W / 2 + T * 2, y: H / 2 - T },
    doorPosition: { x: W / 2, y: H - T * 1.5 },
    furniture: [
      { x: W / 2, y: T * 3, w: T * 6, h: T, color: 0x664422, label: 'Bar Counter' },
      { x: T * 3, y: H / 2 + T, w: T * 2, h: T * 2, color: 0x553311, label: 'Table' },
      { x: W - T * 5, y: H / 2 + T, w: T * 2, h: T * 2, color: 0x553311, label: 'Table' },
      { x: T * 3, y: H / 2 + T * 4, w: T * 2, h: T * 2, color: 0x553311, label: 'Table' },
      { x: W / 2, y: T * 5, w: T * 2, h: T, color: 0x887744, label: 'Fireplace' },
      { x: W - T * 3, y: T * 3, w: T, h: T * 2, color: 0x554433, label: 'Barrels' },
    ],
  },
  {
    id: 'market',
    name: 'Anna\'s Shop',
    npcId: 'merchant_anna',
    bgColor: 0x12101a,
    floorColor: 0x2e2a3e,
    wallColor: 0x3e3050,
    spawnPoint: { x: W / 2, y: H - T * 3 },
    npcPosition: { x: W / 2, y: H / 2 - T * 2 },
    doorPosition: { x: W / 2, y: H - T * 1.5 },
    furniture: [
      { x: W / 2, y: T * 4, w: T * 8, h: T, color: 0x664488, label: 'Display Counter' },
      { x: T * 2, y: H / 2, w: T * 2, h: T * 3, color: 0x554477, label: 'Shelf' },
      { x: W - T * 4, y: H / 2, w: T * 2, h: T * 3, color: 0x554477, label: 'Shelf' },
      { x: W / 2, y: H / 2 + T * 2, w: T * 3, h: T, color: 0x443366, label: 'Crates' },
      { x: T * 2, y: T * 3, w: T, h: T * 2, color: 0x887766, label: 'Scale' },
    ],
  },
  {
    id: 'farm',
    name: 'Thomas\'s Farmhouse',
    npcId: 'farmer_thomas',
    bgColor: 0x0f1a0a,
    floorColor: 0x3a4428,
    wallColor: 0x4a5430,
    spawnPoint: { x: W / 2, y: H - T * 3 },
    npcPosition: { x: W / 2 - T * 2, y: H / 2 },
    doorPosition: { x: W / 2, y: H - T * 1.5 },
    furniture: [
      { x: W / 2, y: T * 3, w: T * 4, h: T * 2, color: 0x664422, label: 'Dining Table' },
      { x: T * 2, y: H / 2 + T * 2, w: T * 3, h: T * 2, color: 0x556633, label: 'Hay Bales' },
      { x: W - T * 4, y: T * 3, w: T * 2, h: T * 2, color: 0x443311, label: 'Cupboard' },
      { x: W - T * 4, y: H / 2 + T * 2, w: T * 2, h: T, color: 0x887744, label: 'Fireplace' },
      { x: T * 2, y: T * 3, w: T, h: T * 2, color: 0x445533, label: 'Tools' },
    ],
  },
  {
    id: 'guard_post',
    name: 'Guard Post',
    npcId: 'guard_marcus',
    bgColor: 0x0f0f1a,
    floorColor: 0x2a2a3a,
    wallColor: 0x3a3a4a,
    spawnPoint: { x: W / 2, y: H - T * 3 },
    npcPosition: { x: W / 2 + T, y: H / 2 - T },
    doorPosition: { x: W / 2, y: H - T * 1.5 },
    furniture: [
      { x: W / 2, y: T * 3, w: T * 3, h: T * 2, color: 0x555566, label: 'Desk' },
      { x: T * 2, y: H / 2, w: T, h: T * 4, color: 0x666677, label: 'Weapon Rack' },
      { x: W - T * 3, y: H / 2, w: T, h: T * 4, color: 0x666677, label: 'Armor Stand' },
      { x: W - T * 4, y: T * 3, w: T * 2, h: T, color: 0x444455, label: 'Map Table' },
      { x: T * 3, y: H / 2 + T * 4, w: T * 2, h: T * 2, color: 0x554433, label: 'Cot' },
    ],
  },
  {
    id: 'herbs',
    name: 'Willow\'s Herb Shop',
    npcId: 'herbalist_willow',
    bgColor: 0x0a1a10,
    floorColor: 0x284a30,
    wallColor: 0x305a38,
    spawnPoint: { x: W / 2, y: H - T * 3 },
    npcPosition: { x: W / 2, y: H / 2 - T },
    doorPosition: { x: W / 2, y: H - T * 1.5 },
    furniture: [
      { x: W / 2, y: T * 3, w: T * 6, h: T, color: 0x336644, label: 'Herb Table' },
      { x: T * 2, y: H / 2, w: T * 2, h: T * 3, color: 0x447755, label: 'Planter' },
      { x: W - T * 4, y: H / 2, w: T * 2, h: T * 3, color: 0x447755, label: 'Planter' },
      { x: T * 3, y: H / 2 + T * 4, w: T * 3, h: T, color: 0x556644, label: 'Drying Rack' },
      { x: W - T * 4, y: T * 3, w: T, h: T * 2, color: 0x664433, label: 'Cauldron' },
    ],
  },
];
