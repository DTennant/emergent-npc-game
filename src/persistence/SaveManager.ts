import { NPC } from '../npc/NPC';
import { Inventory } from '../inventory/Inventory';
import { WorldState, WorldStateJSON } from '../world/WorldState';
import { EpisodicMemory, SemanticMemory, SocialRelationship } from '../memory/types';

interface NPCSaveData {
  memory: {
    ownerId: string;
    episodic: EpisodicMemory[];
    semantic: Record<string, SemanticMemory>;
    social: Record<string, SocialRelationship>;
  };
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
}

const SAVE_KEY = 'game_save';
const SAVE_VERSION = '0.1.0';

export class SaveManager {
  static save(
    worldState: WorldState,
    npcs: NPC[],
    inventory: Inventory,
    playerPosition: { x: number; y: number }
  ): void {
    const npcData: Record<string, NPCSaveData> = {};
    for (const npc of npcs) {
      npcData[npc.persona.id] = {
        memory: npc.memory.toJSON() as NPCSaveData['memory'],
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
      const data = JSON.parse(raw) as SaveData;
      if (!data.version || !data.world || !data.npcs) return null;
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
