import Phaser from 'phaser';
import { LoginScene } from './scenes/LoginScene';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { DialogueScene } from './scenes/DialogueScene';
import { HUDScene } from './scenes/HUDScene';
import { InventoryScene } from './scenes/InventoryScene';
import { CraftingScene } from './scenes/CraftingScene';
import { TradeScene } from './scenes/TradeScene';
import { DungeonScene } from './scenes/DungeonScene';
import { WoodsScene } from './scenes/WoodsScene';
import { AncientForestScene } from './scenes/AncientForestScene';
import { SettingsScene } from './scenes/SettingsScene';
import { BuildingInteriorScene } from './scenes/BuildingInteriorScene';
import { DebugOverlayScene } from './scenes/DebugOverlayScene';
import { QuestJournalScene } from './scenes/QuestJournalScene';
import { VictoryScene } from './scenes/VictoryScene';
import { DebugManager } from './debug/DebugManager';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: { width: 640, height: 480 },
  },
  dom: {
    createContainer: true,
  },
  scene: [LoginScene, BootScene, WorldScene, WoodsScene, AncientForestScene, DialogueScene, HUDScene, InventoryScene, CraftingScene, TradeScene, DungeonScene, SettingsScene, BuildingInteriorScene, DebugOverlayScene, QuestJournalScene, VictoryScene],
};

const game = new Phaser.Game(config);
new DebugManager(game);

console.log('🌍 Emergent NPC World — Thornwick Village');
console.log('WASD to move, E to interact with NPCs');
console.log('Set API key: localStorage.setItem("openai_api_key", "sk-...")');
console.log('For LiteLLM: localStorage.setItem("llm_base_url", "http://localhost:4000/v1")');
console.log('Change model: localStorage.setItem("llm_model", "gpt-4o-mini")');
