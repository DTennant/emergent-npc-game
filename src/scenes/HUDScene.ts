import Phaser from 'phaser';
import { WorldState } from '../world/WorldState';
import { LLMClient } from '../ai/LLMClient';
import { ITEMS } from '../inventory/types';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface HUDData {
  worldState: WorldState;
  llmClient: LLMClient;
}

export class HUDScene extends Phaser.Scene {
  private worldState!: WorldState;
  private llmClient!: LLMClient;
  private timeText!: Phaser.GameObjects.Text;
  private dayText!: Phaser.GameObjects.Text;
  private apiStatus!: Phaser.GameObjects.Text;
  private notificationText!: Phaser.GameObjects.Text;
  private notificationTimer = 0;
  private equippedWeaponText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HUDScene' });
  }

  init(data: HUDData): void {
    this.worldState = data.worldState;
    this.llmClient = data.llmClient;
  }

  create(): void {
    // HUD background strip
    this.add.rectangle(GAME_WIDTH / 2, 16, GAME_WIDTH, 32, 0x000000, 0.6).setDepth(100);

    // Time display
    this.timeText = this.add.text(10, 8, '06:00', {
      fontSize: '16px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.timeText.setDepth(101);

    // Day display
    this.dayText = this.add.text(90, 8, 'Day 1', {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.dayText.setDepth(101);

    // API status
    const hasApi = this.llmClient.hasApiKey();
    this.apiStatus = this.add.text(GAME_WIDTH - 50, 8, hasApi ? '🟢 LLM' : '🟡 Fallback', {
      fontSize: '12px',
      color: hasApi ? '#44ff44' : '#ffaa00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.apiStatus.setOrigin(1, 0);
    this.apiStatus.setDepth(101);

    this.add
      .text(GAME_WIDTH / 2, 8, 'WASD: Move | E: Talk | I: Inventory | ESC: Close', {
        fontSize: '12px',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5, 0)
      .setDepth(101);

    this.equippedWeaponText = this.add.text(10, GAME_HEIGHT - 30, 'Weapon: (none)', {
      fontSize: '14px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    }).setDepth(101);

    // Notification area
    this.notificationText = this.add.text(GAME_WIDTH / 2, 40, '', {
      fontSize: '13px',
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
      resolution: window.devicePixelRatio,
    });
    this.notificationText.setOrigin(0.5);
    this.notificationText.setDepth(101);
    this.notificationText.setVisible(false);

    const settingsBtn = this.add.text(GAME_WIDTH - 30, 6, '⚙️', {
      fontSize: '20px',
      resolution: window.devicePixelRatio,
    });
    settingsBtn.setDepth(101);
    settingsBtn.setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerdown', () => {
      if (!this.scene.isActive('SettingsScene')) {
        this.scene.launch('SettingsScene', { onClose: () => {} });
      }
    });
    settingsBtn.on('pointerover', () => settingsBtn.setScale(1.1));
    settingsBtn.on('pointerout', () => settingsBtn.setScale(1));

    EventBus.on(Events.SHOW_NOTIFICATION, (data: { text: string }) => {
      this.showNotification(data.text);
    });

    EventBus.on(Events.DIALOGUE_START, (data: { npc: { persona: { name: string } } }) => {
      this.showNotification(`Speaking with ${data.npc.persona.name}...`);
    });

    EventBus.on(Events.INVENTORY_CHANGE, (data: { equipped: Record<string, string | null> }) => {
      const weaponId = data.equipped.weapon;
      if (weaponId && ITEMS[weaponId]) {
        const def = ITEMS[weaponId];
        const dmg = def.stats?.damage ? ` (dmg: ${def.stats.damage})` : '';
        this.equippedWeaponText.setText(`Weapon: ${def.name}${dmg}`);
        this.equippedWeaponText.setColor('#ffcc00');
      } else {
        this.equippedWeaponText.setText('Weapon: (none)');
        this.equippedWeaponText.setColor('#aaaaaa');
      }
    });

    EventBus.on(Events.ITEM_ACQUIRED, (data: { itemId: string; quantity: number }) => {
      const def = ITEMS[data.itemId];
      if (def) {
        const qtyStr = data.quantity > 1 ? ` x${data.quantity}` : '';
        this.showNotification(`Acquired: ${def.name}${qtyStr}`);
      }
    });
  }

  update(_time: number, delta: number): void {
    // Update time display
    this.timeText.setText(`🕐 ${this.worldState.getTimeString()}`);
    this.dayText.setText(`📅 Day ${this.worldState.getDay()}`);

    // Notification fade
    if (this.notificationTimer > 0) {
      this.notificationTimer -= delta;
      if (this.notificationTimer <= 0) {
        this.notificationText.setVisible(false);
      }
    }
  }

  private showNotification(text: string): void {
    this.notificationText.setText(text);
    this.notificationText.setVisible(true);
    this.notificationTimer = 3000;
  }
}
