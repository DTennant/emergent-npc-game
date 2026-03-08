import { NPC } from '../npc/NPC';
import { Inventory } from '../inventory/Inventory';
import { WorldState, WorldStateJSON } from '../world/WorldState';
import { EpisodicMemory, SemanticMemory, SocialRelationship, NPCGoal } from '../memory/types';
import { AldricJournal } from '../story/AldricJournal';

interface NPCSaveData {
  memory: {
    ownerId: string;
    episodic: EpisodicMemory[];
    semantic: Record<string, SemanticMemory>;
    social: Record<string, SocialRelationship>;
  };
  goals: NPCGoal[];
  position: { x: number; y: number };
}

interface InventorySaveData {
  items: { itemId: string; quantity: number }[];
  equipped: Record<string, string | null>;
}

export interface SaveData {
  version: string;
  timestamp: number;
  world: WorldStateJSON;
  npcs: Record<string, NPCSaveData>;
  inventory: InventorySaveData;
  player: { x: number; y: number };
  currentZone?: 'village' | 'woods' | 'dungeon' | 'ancient_forest';
  journal?: { discoveredPages: string[] };
  ancientForestClearing?: number;
  progression?: { level: number; xp: number; bonusDamage: number };
}

const SAVE_KEY = 'game_save';
const SAVE_VERSION = '0.2.0';

function migrateSaveData(data: Record<string, unknown>): SaveData {
  // v0.1.0 → v0.2.0: added journal field
  if (!data.journal) {
    (data as unknown as SaveData).journal = { discoveredPages: [] };
  }
  (data as unknown as SaveData).version = SAVE_VERSION;
  return data as unknown as SaveData;
}

export class SaveManager {
  static save(
    worldState: WorldState,
    npcs: NPC[],
    inventory: Inventory,
    playerPosition: { x: number; y: number },
    currentZone: 'village' | 'woods' | 'dungeon' | 'ancient_forest' = 'village',
    aldricJournal?: AldricJournal,
    ancientForestClearing?: number,
    progression?: { level: number; xp: number; bonusDamage: number }
  ): void {
    const npcData: Record<string, NPCSaveData> = {};
    for (const npc of npcs) {
      npcData[npc.persona.id] = {
        memory: npc.memory.toJSON() as NPCSaveData['memory'],
        goals: npc.goals.toJSON(),
        position: { x: npc.sprite.x, y: npc.sprite.y },
      };
    }

    const blob: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      world: worldState.toJSON(),
      npcs: npcData,
      inventory: inventory.toJSON(),
      player: { x: playerPosition.x, y: playerPosition.y },
      currentZone,
      journal: aldricJournal ? aldricJournal.toJSON() : { discoveredPages: [] },
      ancientForestClearing: ancientForestClearing,
      progression: progression,
    };

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }

  static load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      let data = JSON.parse(raw) as SaveData;
      if (!data.version || !data.world || !data.npcs) return null;
      if (data.version !== SAVE_VERSION) {
        console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${data.version}. Attempting migration...`);
        data = migrateSaveData(data as unknown as Record<string, unknown>);
      }
      return data;
    } catch (e) {
      console.error('Failed to load save:', e);
      return null;
    }
  }

  static hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  static deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
