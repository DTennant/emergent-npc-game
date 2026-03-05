import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  BLIGHT_BASE_INTENSITY,
  BLIGHT_DAILY_INCREASE,
  BLIGHT_OVERLAY_DEPTH,
} from '../config';

export interface BlightSystemJSON {
  intensity: number;
  sealed: boolean;
}

export class BlightSystem {
  private scene: Phaser.Scene;
  private intensity: number = BLIGHT_BASE_INTENSITY;
  private sealed = false;
  private rightOverlay: Phaser.GameObjects.Rectangle;
  private bottomOverlay: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const overlayWidth = GAME_WIDTH * 0.2;
    const overlayHeight = GAME_HEIGHT * 0.2;
    const blightColor = 0x1a0020;

    this.rightOverlay = scene.add.rectangle(
      GAME_WIDTH - overlayWidth / 2,
      GAME_HEIGHT / 2,
      overlayWidth,
      GAME_HEIGHT,
      blightColor,
      this.intensity * 0.6
    );
    this.rightOverlay.setDepth(BLIGHT_OVERLAY_DEPTH);

    this.bottomOverlay = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - overlayHeight / 2,
      GAME_WIDTH,
      overlayHeight,
      blightColor,
      this.intensity * 0.6
    );
    this.bottomOverlay.setDepth(BLIGHT_OVERLAY_DEPTH);

    this.addPulseTween(this.rightOverlay);
    this.addPulseTween(this.bottomOverlay);
  }

  private addPulseTween(target: Phaser.GameObjects.Rectangle): void {
    this.scene.tweens.add({
      targets: target,
      alpha: { from: target.alpha - 0.05, to: target.alpha + 0.05 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(day: number): void {
    if (this.sealed) return;

    this.intensity = Math.min(1, BLIGHT_BASE_INTENSITY + BLIGHT_DAILY_INCREASE * (day - 1));
    this.updateOverlays();
  }

  private updateOverlays(): void {
    const baseAlpha = this.intensity * 0.6;

    this.scene.tweens.killTweensOf(this.rightOverlay);
    this.scene.tweens.killTweensOf(this.bottomOverlay);

    this.rightOverlay.setAlpha(baseAlpha);
    this.bottomOverlay.setAlpha(baseAlpha);

    this.addPulseTween(this.rightOverlay);
    this.addPulseTween(this.bottomOverlay);
  }

  getIntensity(): number {
    return this.intensity;
  }

  getWolfSpawnCount(): number {
    return 2 + Math.floor(this.intensity * 5);
  }

  isSealed(): boolean {
    return this.sealed;
  }

  seal(): void {
    this.sealed = true;
    this.intensity = 0;

    this.scene.tweens.killTweensOf(this.rightOverlay);
    this.scene.tweens.killTweensOf(this.bottomOverlay);

    this.rightOverlay.setAlpha(0);
    this.bottomOverlay.setAlpha(0);
    this.rightOverlay.setVisible(false);
    this.bottomOverlay.setVisible(false);
  }

  toJSON(): BlightSystemJSON {
    return {
      intensity: this.intensity,
      sealed: this.sealed,
    };
  }

  fromJSON(data: BlightSystemJSON): void {
    this.intensity = data.intensity;
    this.sealed = data.sealed;

    if (this.sealed) {
      this.seal();
    } else {
      this.updateOverlays();
    }
  }
}
