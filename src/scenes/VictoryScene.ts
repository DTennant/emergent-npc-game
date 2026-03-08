import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, fs } from '../config';
import { GameState } from '../world/GameState';

export class VictoryScene extends Phaser.Scene {
  private phaseObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(): void {
    this.showPhase1();
  }

  private showPhase1(): void {
    // Dark overlay fading in
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0
    );
    overlay.setDepth(300);
    this.phaseObjects.push(overlay);

    this.tweens.add({
      targets: overlay,
      alpha: 0.7,
      duration: 500,
      ease: 'Linear',
    });

    // Center text fading in
    const resonateText = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40,
      'The Runestones resonate...',
      {
        fontSize: fs(32),
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: window.devicePixelRatio,
      }
    );
    resonateText.setOrigin(0.5);
    resonateText.setDepth(301);
    resonateText.setAlpha(0);
    this.phaseObjects.push(resonateText);

    this.tweens.add({
      targets: resonateText,
      alpha: 1,
      duration: 800,
      delay: 300,
      ease: 'Sine.easeIn',
    });

    // Golden particle burst from center
    if (this.textures.exists('particle_spark')) {
      const particles = this.add.particles(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'particle_spark', {
        emitting: false,
        lifespan: { min: 800, max: 1500 },
        speed: { min: 100, max: 300 },
        angle: { min: 0, max: 360 },
        scale: { start: 2, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd700, 0xffaa00, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
      });
      particles.setDepth(302);
      particles.explode(30, GAME_WIDTH / 2, GAME_HEIGHT / 2);
      this.phaseObjects.push(particles);
    }

    // Camera golden flash
    this.cameras.main.flash(1000, 255, 215, 0);

    // Transition to Phase 2 after 3 seconds
    this.time.delayedCall(3000, () => {
      this.showPhase2();
    });
  }

  private showPhase2(): void {
    // Destroy Phase 1 elements
    for (const obj of this.phaseObjects) {
      obj.destroy();
    }
    this.phaseObjects = [];

    // Persistent dark overlay for Phase 2
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.8
    );
    overlay.setDepth(300);

    // Title
    const title = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT * 0.15,
      'The Blight Has Been Sealed',
      {
        fontSize: fs(40),
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 4,
        resolution: window.devicePixelRatio,
      }
    );
    title.setOrigin(0.5);
    title.setDepth(301);

    // Subtitle
    const subtitle = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT * 0.22,
      'Thornwick is saved.',
      {
        fontSize: fs(22),
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      }
    );
    subtitle.setOrigin(0.5);
    subtitle.setDepth(301);

    // Journey summary
    const gs = GameState.get(this);
    const day = gs.worldState.getDay();

    let dungeonsCleared = 0;
    for (const status of Object.values(gs.storylineManager.runestoneStatus)) {
      if (status.dungeonCleared) {
        dungeonsCleared++;
      }
    }

    const summaryLines = [
      `Days survived: ${day}`,
      `Dungeons cleared: ${dungeonsCleared}/3`,
      'Runestones collected: 3/3',
    ];

    const summary = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT * 0.40,
      summaryLines.join('\n'),
      {
        fontSize: fs(20),
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        lineSpacing: 12,
        resolution: window.devicePixelRatio,
      }
    );
    summary.setOrigin(0.5);
    summary.setDepth(301);

    // Gold particle rain
    if (this.textures.exists('particle_circle')) {
      const rain = this.add.particles(0, 0, 'particle_circle', {
        x: { min: 0, max: GAME_WIDTH },
        y: -20,
        lifespan: { min: 3000, max: 5000 },
        speed: { min: 30, max: 60 },
        angle: { min: 80, max: 100 },
        scale: { start: 0.5, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        tint: [0xffd700, 0xffcc00],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 100,
        quantity: 2,
      });
      rain.setDepth(302);
    }

    // "Continue Playing" button
    const btnY = GAME_HEIGHT * 0.72;
    const btnBg = this.add.rectangle(
      GAME_WIDTH / 2, btnY,
      300, 50,
      0x2a6a2a
    );
    btnBg.setStrokeStyle(2, 0x44ff44);
    btnBg.setDepth(301);
    btnBg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(
      GAME_WIDTH / 2, btnY,
      'Continue Playing',
      {
        fontSize: fs(22),
        color: '#ffffff',
        resolution: window.devicePixelRatio,
      }
    );
    btnText.setOrigin(0.5);
    btnText.setDepth(302);

    // Sandbox mode hint
    const sandboxHint = this.add.text(
      GAME_WIDTH / 2, btnY + 40,
      'The world continues in sandbox mode',
      {
        fontSize: fs(14),
        color: '#aaaaaa',
        resolution: window.devicePixelRatio,
      }
    );
    sandboxHint.setOrigin(0.5);
    sandboxHint.setDepth(301);

    // Button hover effects
    btnBg.on('pointerover', () => {
      btnBg.setScale(1.05);
      btnText.setScale(1.05);
      btnBg.setFillStyle(0x358035);
    });

    btnBg.on('pointerout', () => {
      btnBg.setScale(1);
      btnText.setScale(1);
      btnBg.setFillStyle(0x2a6a2a);
    });

    btnBg.on('pointerdown', () => {
      this.close();
    });
  }

  shutdown(): void {
    this.tweens.killAll();
  }

  private close(): void {
    this.scene.stop('VictoryScene');
  }
}
