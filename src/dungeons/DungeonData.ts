import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';

export interface DungeonRoom {
  walls: { x: number; y: number; w: number; h: number }[];
  obstacles: { x: number; y: number; w: number; h: number }[];
  enemies: { x: number; y: number; type: string }[];
  doorTo?: number;
  doorFrom?: number;
  doorPosition: { x: number; y: number };
  spawnPoint: { x: number; y: number };
}

export interface DungeonDef {
  id: string;
  name: string;
  requiredItem: string;
  bossRoom: number;
  runestoneId: string;
  rooms: DungeonRoom[];
  bgColor: number;
}

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const T = TILE_SIZE;
const WALL = T;

export const DUNGEONS: DungeonDef[] = [
  // --- Forest Cave ---
  {
    id: 'forest_cave',
    name: 'Forest Cave',
    requiredItem: 'lantern',
    bossRoom: 2,
    runestoneId: 'runestone_forest',
    bgColor: 0x1a1a0a,
    rooms: [
      // Room 0: Entry with 2 wolves
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },               // top
          { x: 0, y: 0, w: WALL, h: H },                // left
          { x: 0, y: H - WALL, w: W, h: WALL },         // bottom
          { x: W - WALL, y: 0, w: WALL, h: H / 2 - T * 2 }, // right-top
          { x: W - WALL, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 }, // right-bottom
        ],
        obstacles: [],
        enemies: [
          { x: 300, y: 200, type: 'wolf' },
          { x: 500, y: 400, type: 'wolf' },
        ],
        doorTo: 1,
        doorPosition: { x: W - WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 3, y: H / 2 },
      },
      // Room 1: Larger room with 3 wolves and obstacles
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },               // top
          { x: 0, y: 0, w: WALL, h: H / 2 - T * 2 },   // left-top
          { x: 0, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 }, // left-bottom
          { x: 0, y: H - WALL, w: W, h: WALL },         // bottom
          { x: W - WALL, y: 0, w: WALL, h: H / 2 - T * 2 }, // right-top
          { x: W - WALL, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 }, // right-bottom
        ],
        obstacles: [
          { x: 250, y: 180, w: T * 2, h: T * 2 },
          { x: 500, y: 350, w: T * 3, h: T },
          { x: 350, y: 450, w: T, h: T * 2 },
        ],
        enemies: [
          { x: 400, y: 150, type: 'wolf' },
          { x: 250, y: 400, type: 'wolf' },
          { x: 600, y: 300, type: 'wolf' },
        ],
        doorFrom: 0,
        doorTo: 2,
        doorPosition: { x: W - WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 2, y: H / 2 },
      },
      // Room 2: Boss room (Shadow Wolf)
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },               // top
          { x: 0, y: 0, w: WALL, h: H / 2 - T * 2 },   // left-top
          { x: 0, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 }, // left-bottom
          { x: 0, y: H - WALL, w: W, h: WALL },         // bottom
          { x: W - WALL, y: 0, w: WALL, h: H },         // right (sealed)
        ],
        obstacles: [],
        enemies: [
          { x: W / 2, y: H / 2, type: 'boss_shadow_wolf' },
        ],
        doorFrom: 1,
        doorPosition: { x: WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 3, y: H / 2 },
      },
    ],
  },

  // --- Abandoned Mine ---
  {
    id: 'abandoned_mine',
    name: 'Abandoned Mine',
    requiredItem: 'rope',
    bossRoom: 2,
    runestoneId: 'runestone_mine',
    bgColor: 0x1a1a1a,
    rooms: [
      // Room 0: Entry with 1 wolf
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },
          { x: 0, y: 0, w: WALL, h: H },
          { x: 0, y: H - WALL, w: W, h: WALL },
          { x: W - WALL, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: W - WALL, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
        ],
        obstacles: [],
        enemies: [
          { x: 400, y: 300, type: 'wolf' },
        ],
        doorTo: 1,
        doorPosition: { x: W - WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 3, y: H / 2 },
      },
      // Room 1: Chasm room (narrow path with gaps)
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },
          { x: 0, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H - WALL, w: W, h: WALL },
          { x: W - WALL, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: W - WALL, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
        ],
        obstacles: [
          // Chasm walls creating a narrow path
          { x: 150, y: WALL, w: T * 2, h: H / 2 - T * 3 },
          { x: 150, y: H / 2 + T, w: T * 2, h: H / 2 - T * 3 },
          { x: 400, y: WALL, w: T * 2, h: H / 2 - T * 2 },
          { x: 400, y: H / 2 + T * 3, w: T * 2, h: H / 2 - T * 4 },
          { x: 600, y: WALL, w: T * 2, h: H / 2 - T * 3 },
          { x: 600, y: H / 2 + T, w: T * 2, h: H / 2 - T * 3 },
        ],
        enemies: [],
        doorFrom: 0,
        doorTo: 2,
        doorPosition: { x: W - WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 2, y: H / 2 },
      },
      // Room 2: Boss room (Crystal Golem)
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },
          { x: 0, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H - WALL, w: W, h: WALL },
          { x: W - WALL, y: 0, w: WALL, h: H },
        ],
        obstacles: [],
        enemies: [
          { x: W / 2, y: H / 2, type: 'boss_crystal_golem' },
        ],
        doorFrom: 1,
        doorPosition: { x: WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 3, y: H / 2 },
      },
    ],
  },

  // --- Ruined Tower ---
  {
    id: 'ruined_tower',
    name: 'Ruined Tower',
    requiredItem: 'enchanted_blade',
    bossRoom: 2,
    runestoneId: 'runestone_tower',
    bgColor: 0x1a0a1a,
    rooms: [
      // Room 0: Entry (empty, atmospheric)
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },
          { x: 0, y: 0, w: WALL, h: H },
          { x: 0, y: H - WALL, w: W, h: WALL },
          { x: W - WALL, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: W - WALL, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
        ],
        obstacles: [],
        enemies: [],
        doorTo: 1,
        doorPosition: { x: W - WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 3, y: H / 2 },
      },
      // Room 1: Puzzle room with obstacles
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },
          { x: 0, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H - WALL, w: W, h: WALL },
          { x: W - WALL, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: W - WALL, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
        ],
        obstacles: [
          { x: 200, y: 100, w: T * 4, h: T },
          { x: 200, y: 200, w: T, h: T * 4 },
          { x: 400, y: 300, w: T * 4, h: T },
          { x: 550, y: 150, w: T, h: T * 5 },
          { x: 350, y: 450, w: T * 5, h: T },
        ],
        enemies: [],
        doorFrom: 0,
        doorTo: 2,
        doorPosition: { x: W - WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 2, y: H / 2 },
      },
      // Room 2: Boss room (Blight Wraith)
      {
        walls: [
          { x: 0, y: 0, w: W, h: WALL },
          { x: 0, y: 0, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H / 2 + T * 2, w: WALL, h: H / 2 - T * 2 },
          { x: 0, y: H - WALL, w: W, h: WALL },
          { x: W - WALL, y: 0, w: WALL, h: H },
        ],
        obstacles: [],
        enemies: [
          { x: W / 2, y: H / 2, type: 'boss_blight_wraith' },
        ],
        doorFrom: 1,
        doorPosition: { x: WALL / 2, y: H / 2 },
        spawnPoint: { x: T * 3, y: H / 2 },
      },
    ],
  },
];
