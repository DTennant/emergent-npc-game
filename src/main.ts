import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { DialogueScene } from './scenes/DialogueScene';
import { HUDScene } from './scenes/HUDScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, WorldScene, DialogueScene, HUDScene],
};

new Phaser.Game(config);

console.log('🌍 Emergent NPC World — Thornwick Village');
console.log('WASD to move, E to interact with NPCs');
console.log('Set OpenAI API key in browser console: localStorage.setItem("openai_api_key", "sk-...")');
