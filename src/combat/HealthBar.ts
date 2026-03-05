import Phaser from 'phaser';

export class HealthBar {
  private background: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private maxHealth: number;
  private barWidth: number;
  private barHeight: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    maxHealth: number
  ) {
    this.maxHealth = maxHealth;
    this.barWidth = width;
    this.barHeight = height;

    this.background = scene.add.rectangle(x, y, width, height, 0x333333);
    this.background.setDepth(50);
    this.background.setOrigin(0.5, 0.5);

    this.fill = scene.add.rectangle(x, y, width, height, 0x00cc00);
    this.fill.setDepth(50);
    this.fill.setOrigin(0.5, 0.5);
  }

  setHealth(current: number): void {
    const ratio = Math.max(0, Math.min(1, current / this.maxHealth));
    this.fill.width = this.barWidth * ratio;

    if (ratio > 0.6) {
      this.fill.fillColor = 0x00cc00;
    } else if (ratio > 0.3) {
      this.fill.fillColor = 0xcccc00;
    } else {
      this.fill.fillColor = 0xcc0000;
    }
  }

  setPosition(x: number, y: number): void {
    this.background.setPosition(x, y);
    this.fill.setPosition(x, y);
  }

  setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.fill.setVisible(visible);
  }

  destroy(): void {
    this.background.destroy();
    this.fill.destroy();
  }
}
