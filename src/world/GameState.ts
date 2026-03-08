import Phaser from 'phaser';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from './WorldState';
import { Inventory } from '../inventory/Inventory';
import { StorylineManager } from '../story/StorylineManager';
import { AldricJournal } from '../story/AldricJournal';
import {
  EpisodicMemory,
  SemanticMemory,
  SocialRelationship,
  SoulDocument,
  MemoryDocument,
  NPCGoal,
} from '../memory/types';

export interface NPCSaveState {
  memory: {
    ownerId: string;
    episodic: EpisodicMemory[];
    semantic: Record<string, SemanticMemory>;
    social: Record<string, SocialRelationship>;
    soul?: SoulDocument | null;
    memoryDoc?: MemoryDocument | null;
    previousPlayerTrust?: number;
  };
  goals: NPCGoal[];
  position: { x: number; y: number };
}

export class GameState {
  llmClient: LLMClient;
  worldState: WorldState;
  inventory: Inventory;
  storylineManager: StorylineManager;
  aldricJournal: AldricJournal;
  npcData: Map<string, NPCSaveState> = new Map();
  currentZone: 'village' | 'woods' | 'dungeon' | 'ancient_forest' = 'village';
  playerPosition: { x: number; y: number } = { x: 640, y: 480 };
  initialized = false;

  constructor() {
    this.llmClient = new LLMClient();
    this.worldState = new WorldState();
    this.inventory = new Inventory();
    this.storylineManager = new StorylineManager();
    this.aldricJournal = new AldricJournal();
  }

  static init(game: Phaser.Game): GameState {
    let gs = game.registry.get('gameState') as GameState | undefined;
    if (!gs) {
      gs = new GameState();
      game.registry.set('gameState', gs);
    }
    return gs;
  }

  static get(scene: Phaser.Scene): GameState {
    return scene.game.registry.get('gameState') as GameState;
  }
}
