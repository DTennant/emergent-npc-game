import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TILE_SIZE } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate procedural textures
    this.createProgressBar();
  }

  create(): void {
    // Generate all textures procedurally
    this.generateTextures();

    // Transition to world scene
    this.scene.start('WorldScene');
  }

  private createProgressBar(): void {
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;

    const text = this.add.text(width / 2, height / 2 - 30, 'Loading Thornwick...', {
      fontSize: '20px',
      color: '#ffffff',
    });
    text.setOrigin(0.5);

    const progressBar = this.add.rectangle(
      width / 2, height / 2 + 10,
      300, 20,
      0x333333
    );
    progressBar.setStrokeStyle(1, 0x666666);

    const progressFill = this.add.rectangle(
      width / 2 - 148, height / 2 + 10,
      0, 16,
      0x44aa44
    );
    progressFill.setOrigin(0, 0.5);

    this.load.on('progress', (value: number) => {
      progressFill.width = 296 * value;
    });
  }

  private generateTextures(): void {
    // Grass tile
    const grassGfx = this.add.graphics();
    grassGfx.fillStyle(COLORS.grass);
    grassGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Add grass detail
    grassGfx.fillStyle(0x2d6b37);
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      grassGfx.fillRect(x, y, 2, 4);
    }
    grassGfx.generateTexture('grass', TILE_SIZE, TILE_SIZE);
    grassGfx.destroy();

    // Path tile
    const pathGfx = this.add.graphics();
    pathGfx.fillStyle(COLORS.path);
    pathGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    pathGfx.fillStyle(0xb89448);
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      pathGfx.fillRect(x, y, 3, 3);
    }
    pathGfx.generateTexture('path', TILE_SIZE, TILE_SIZE);
    pathGfx.destroy();
  }
}
