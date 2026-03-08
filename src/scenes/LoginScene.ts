import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, fs, fsn } from '../config';
import { SaveManager } from '../persistence/SaveManager';

function getInputStyle(): string {
  return [
    'width: 300px',
    'padding: 10px',
    `font-size: ${fsn(28)}px`,
    'background: #2a2a4e',
    'color: #ffffff',
    'border: 1px solid #4488ff',
    'border-radius: 4px',
    'outline: none',
    'text-align: center',
  ].join('; ');
}

export class LoginScene extends Phaser.Scene {
  private usernameInput!: HTMLInputElement;
  private domElements: Phaser.GameObjects.DOMElement[] = [];
  private particles: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'LoginScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a1a');

    this.createParticleField();
    this.createTitle();
    this.createLoginForm();
    this.createMenuButtons();
    this.createFooter();
  }

  private createParticleField(): void {
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      const radius = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.5);
      const particle = this.add.circle(x, y, radius, 0x4488ff, alpha);
      particle.setDepth(0);
      this.particles.push(particle);

      this.tweens.add({
        targets: particle,
        alpha: { from: alpha, to: Phaser.Math.FloatBetween(0.05, 0.3) },
        y: y + Phaser.Math.Between(-30, 30),
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createTitle(): void {
    const titleY = GAME_HEIGHT * 0.18;

    const glow = this.add.text(GAME_WIDTH / 2, titleY, '✦ Emergent NPC World ✦', {
      fontSize: fs(64),
      color: '#2255aa',
      resolution: window.devicePixelRatio,
    });
    glow.setOrigin(0.5);
    glow.setDepth(1);
    glow.setAlpha(0.4);

    const title = this.add.text(GAME_WIDTH / 2, titleY, '✦ Emergent NPC World ✦', {
      fontSize: fs(64),
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: window.devicePixelRatio,
    });
    title.setOrigin(0.5);
    title.setDepth(2);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.2, to: 0.6 },
      scaleX: { from: 1.0, to: 1.02 },
      scaleY: { from: 1.0, to: 1.02 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const subtitle = this.add.text(GAME_WIDTH / 2, titleY + 60, 'The Blight of Thornwick', {
      fontSize: fs(34),
      color: '#aabbdd',
      fontStyle: 'italic',
      resolution: window.devicePixelRatio,
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(2);
  }

  private createLoginForm(): void {
    const formY = GAME_HEIGHT * 0.45;

    const label = this.add.text(GAME_WIDTH / 2, formY - 40, 'Enter Your Name', {
      fontSize: fs(30),
      color: '#8899bb',
      resolution: window.devicePixelRatio,
    });
    label.setOrigin(0.5);
    label.setDepth(2);

    this.usernameInput = document.createElement('input');
    this.usernameInput.type = 'text';
    this.usernameInput.placeholder = 'Adventurer';
    this.usernameInput.maxLength = 20;
    this.usernameInput.value = localStorage.getItem('player_name') || '';
    this.usernameInput.style.cssText = getInputStyle();

    const inputDom = this.add.dom(GAME_WIDTH / 2, formY + 10, this.usernameInput);
    inputDom.setDepth(3);
    this.domElements.push(inputDom);

    this.usernameInput.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.startGame();
      }
    });

    setTimeout(() => this.usernameInput.focus(), 200);
  }

  private createMenuButtons(): void {
    const btnY = GAME_HEIGHT * 0.62;
    const btnSpacing = 70;

    this.createButton(GAME_WIDTH / 2, btnY, 'Begin Adventure', 0x2a6e2a, 0x3a8e3a, () => {
      this.startGame();
    });

    const hasSave = SaveManager.hasSave();
    if (hasSave) {
      this.createButton(GAME_WIDTH / 2, btnY + btnSpacing, 'Continue Journey', 0x2a4e6e, 0x3a6e8e, () => {
        this.startGame();
      });
    }

    this.createButton(
      GAME_WIDTH / 2,
      btnY + btnSpacing * (hasSave ? 2 : 1),
      '⚙️ Settings',
      0x4a4a6e,
      0x5a5a8e,
      () => {
        this.scene.launch('SettingsScene', {
          onClose: () => {
            setTimeout(() => this.usernameInput?.focus(), 100);
          },
        });
      }
    );
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    hoverColor: number,
    onClick: () => void
  ): void {
    const btn = this.add.rectangle(x, y, 320, 56, color);
    btn.setStrokeStyle(1, 0x6688aa);
    btn.setDepth(2);
    btn.setInteractive({ useHandCursor: true });

    const text = this.add.text(x, y, label, {
      fontSize: fs(32),
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    text.setOrigin(0.5);
    text.setDepth(3);

    btn.on('pointerover', () => {
      btn.setFillStyle(hoverColor);
      text.setScale(1.03);
    });
    btn.on('pointerout', () => {
      btn.setFillStyle(color);
      text.setScale(1);
    });
    btn.on('pointerdown', onClick);
  }

  private createFooter(): void {
    const footerY = GAME_HEIGHT * 0.92;

    const version = this.add.text(GAME_WIDTH / 2, footerY, 'v0.1.0  •  AI-Powered NPCs with Memory & Personality', {
      fontSize: fs(20),
      color: '#556677',
      resolution: window.devicePixelRatio,
    });
    version.setOrigin(0.5);
    version.setDepth(1);

    const hint = this.add.text(GAME_WIDTH / 2, footerY + 30, 'WASD to move  •  E to interact  •  I for inventory  •  H for help', {
      fontSize: fs(20),
      color: '#445566',
      resolution: window.devicePixelRatio,
    });
    hint.setOrigin(0.5);
    hint.setDepth(1);
  }

  private startGame(): void {
    const name = this.usernameInput.value.trim() || 'Adventurer';
    localStorage.setItem('player_name', name);
    this.cleanupInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.scene.start('BootScene');
  }

  private cleanupInputs(): void {
    this.domElements.forEach((dom) => dom.destroy());
    this.domElements = [];
  }

  shutdown(): void {
    this.cleanupInputs();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}
