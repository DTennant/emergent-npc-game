import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { DialogueScene } from './scenes/DialogueScene';
import { HUDScene } from './scenes/HUDScene';
import { InventoryScene } from './scenes/InventoryScene';
import { CraftingScene } from './scenes/CraftingScene';
import { TradeScene } from './scenes/TradeScene';
import { DungeonScene } from './scenes/DungeonScene';
import { WoodsScene } from './scenes/WoodsScene';
import { SettingsScene } from './scenes/SettingsScene';
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
  },
  dom: {
    createContainer: true,
  },
  scene: [BootScene, WorldScene, WoodsScene, DialogueScene, HUDScene, InventoryScene, CraftingScene, TradeScene, DungeonScene, SettingsScene],
};

new Phaser.Game(config);

console.log('🌍 Emergent NPC World — Thornwick Village');
console.log('WASD to move, E to interact with NPCs');
console.log('Set API key: localStorage.setItem("openai_api_key", "sk-...")');
console.log('For LiteLLM: localStorage.setItem("llm_base_url", "http://localhost:4000/v1")');
console.log('Change model: localStorage.setItem("llm_model", "gpt-4o-mini")');
