import Phaser from 'phaser';
import { WorldState } from '../world/WorldState';
import { LLMClient } from '../ai/LLMClient';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH } from '../config';

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

  constructor() {
    super({ key: 'HUDScene' });
  }

  init(data: HUDData): void {
    this.worldState = data.worldState;
    this.llmClient = data.llmClient;
  }

  create(): void {
    // HUD background strip
    this.add.rectangle(GAME_WIDTH / 2, 12, GAME_WIDTH, 24, 0x000000, 0.6).setDepth(100);

    // Time display
    this.timeText = this.add.text(10, 4, '06:00', {
      fontSize: '14px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.timeText.setDepth(101);

    // Day display
    this.dayText = this.add.text(80, 4, 'Day 1', {
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.dayText.setDepth(101);

    // API status
    const hasApi = this.llmClient.hasApiKey();
    this.apiStatus = this.add.text(GAME_WIDTH - 10, 4, hasApi ? '🟢 LLM' : '🟡 Fallback', {
      fontSize: '11px',
      color: hasApi ? '#44ff44' : '#ffaa00',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.apiStatus.setOrigin(1, 0);
    this.apiStatus.setDepth(101);

    // Controls hint
    this.add
      .text(GAME_WIDTH / 2, 4, 'WASD: Move | E: Talk | ESC: Close', {
        fontSize: '10px',
        color: '#888888',
        stroke: '#000000',
        strokeThickness: 1,
      })
      .setOrigin(0.5, 0)
      .setDepth(101);

    // Notification area
    this.notificationText = this.add.text(GAME_WIDTH / 2, 40, '', {
      fontSize: '13px',
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    });
    this.notificationText.setOrigin(0.5);
    this.notificationText.setDepth(101);
    this.notificationText.setVisible(false);

    // Listen for events
    EventBus.on(Events.SHOW_NOTIFICATION, (data: { text: string }) => {
      this.showNotification(data.text);
    });

    EventBus.on(Events.DIALOGUE_START, (data: { npc: { persona: { name: string } } }) => {
      this.showNotification(`Speaking with ${data.npc.persona.name}...`);
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
