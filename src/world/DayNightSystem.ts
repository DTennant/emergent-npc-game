import Phaser from 'phaser';

export class DayNightSystem {
  private overlay: Phaser.GameObjects.Rectangle;
  private targetAlpha = 0;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Full-screen overlay: dark blue tint for night, fixed to camera
    this.overlay = scene.add.rectangle(
      0, 0,
      scene.scale.width * 2, scene.scale.height * 2,
      0x000033, 0
    );
    this.overlay.setOrigin(0, 0);
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(45); // Above blight (30), below UI (50+)
  }

  // Call in update() with current hour (0-23 integer)
  update(hour: number): void {
    let alpha = 0;

    if (hour >= 5 && hour < 6) {
      // Dawn: 0.55 → 0
      alpha = 0.55 * (1 - (hour - 5));
    } else if (hour >= 6 && hour < 16) {
      // Day: fully bright
      alpha = 0;
    } else if (hour >= 16 && hour < 20) {
      // Dusk transition: 0 → 0.45
      alpha = ((hour - 16) / 4) * 0.45;
    } else if (hour >= 20 && hour < 22) {
      // Late evening: 0.45 → 0.55
      alpha = 0.45 + ((hour - 20) / 2) * 0.1;
    } else {
      // Night (22-5): full darkness
      alpha = 0.55;
    }

    this.targetAlpha = alpha;

    // Smooth lerp toward target to avoid flicker
    const current = this.overlay.alpha;
    const lerpSpeed = 0.02;
    this.overlay.setAlpha(current + (this.targetAlpha - current) * lerpSpeed);
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
