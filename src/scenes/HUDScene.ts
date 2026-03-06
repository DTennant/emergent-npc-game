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
  private helpVisible = false;
  private helpPanel!: Phaser.GameObjects.Container;
  private shownHints: Set<string> = new Set();
  private questTrackerText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HUDScene' });
    this.loadShownHints();
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

    // Quest Tracker
    this.questTrackerText = this.add.text(GAME_WIDTH - 120, 40, '', {
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'right',
      wordWrap: { width: 220 },
      resolution: window.devicePixelRatio,
    });
    this.questTrackerText.setOrigin(1, 0);
    this.questTrackerText.setDepth(101);
    this.updateQuestTracker();

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

    EventBus.on(Events.SHOW_NOTIFICATION, (data: string | { message?: string; text?: string }) => {
      if (typeof data === 'string') {
        this.showNotification(data);
      } else {
        this.showNotification(data.message ?? data.text ?? '');
      }
    });

    EventBus.on(Events.DIALOGUE_START, (data: { npc: { persona: { name: string } } }) => {
      this.showNotification(`Speaking with ${data.npc.persona.name}...`);
      this.showHint('dialogue', 'Build trust by having more conversations. NPCs share knowledge as trust grows.');
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
        this.showHint('inventory_usage', 'Press I to manage items. Equip weapons and gather materials for NPCs.');
        this.updateQuestTracker();
      }
    });
    
    EventBus.on(Events.PLAYER_ATTACK, () => {
      this.showHint('combat', 'Press SPACE to attack! Watch your health bar.');
    });

    EventBus.on(Events.QUEST_PROGRESS, () => {
        this.updateQuestTracker();
    });

    // Check low health
    EventBus.on(Events.ENTITY_DAMAGED, (data: { entity: string, currentHealth: number, maxHealth: number }) => {
        if (data.entity === 'player' && data.currentHealth < data.maxHealth * 0.3) {
            this.showHint('low_health', 'Your health is low! Find safety or eat provisions.');
        }
    });

    this.input.keyboard!.addKey('H').on('down', () => this.toggleHelp());
    this.createHelpPanel();

    // Initial Hints
    this.time.delayedCall(1000, () => {
        this.showHint('welcome', 'Welcome to Thornwick! Use WASD to move. Press E near an NPC to talk.');
    });
  }

  update(_time: number, delta: number): void {
    // Update time display
    this.timeText.setText(`🕐 ${this.worldState.getTimeString()}`);
    this.dayText.setText(`📅 Day ${this.worldState.getDay()}`);
    
    // Check quest tracker update occasionally if needed, but events are better
    if (this.time.now % 1000 < delta) {
        this.updateQuestTracker();
    }

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

  private showHint(id: string, message: string): void {
    if (this.shownHints.has(id)) return;
    
    this.shownHints.add(id);
    localStorage.setItem('hints_shown', JSON.stringify(Array.from(this.shownHints)));

    const hintBg = this.add.rectangle(GAME_WIDTH / 2, 70, 500, 40, 0x1a3366, 0.9);
    hintBg.setStrokeStyle(1, 0x4488ff);
    hintBg.setDepth(150);

    const hintText = this.add.text(GAME_WIDTH / 2, 70, '💡 ' + message, {
      fontSize: '13px',
      color: '#ffffff',
      align: 'center',
      resolution: window.devicePixelRatio,
    });
    hintText.setOrigin(0.5);
    hintText.setDepth(151);

    this.tweens.add({
      targets: [hintBg, hintText],
      alpha: 0,
      delay: 5000,
      duration: 1000,
      onComplete: () => {
        hintBg.destroy();
        hintText.destroy();
      },
    });
  }

  private loadShownHints(): void {
    const stored = localStorage.getItem('hints_shown');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.shownHints = new Set(parsed);
        }
      } catch (e) {
        console.error('Failed to load hints', e);
      }
    }
  }

  private updateQuestTracker(): void {
    if (!this.worldState) return;
    
    let text = 'Current Objective:\n';
    const sl = this.worldState.storylineData; // Access raw data if possible, or use manager via world state if available
    // But WorldState in HUD is just data structure. Let's assume we can infer state or check props.
    // Actually WorldState class has methods.
    
    // We need to check storyline status. 
    // WorldState doesn't expose StorylineManager directly, but it holds `storylineData`.
    // We can inspect `this.worldState.storylineData`
    
    const s = this.worldState.storylineData;
    if (!s) return;

    if (s.shrineActivated) {
        text += '✓ Shrine Activated!\nThe Blight is sealed.';
        this.questTrackerText.setColor('#44ff44');
    } else if (s.runestoneStatus && Object.values(s.runestoneStatus).filter(v => v).length === 3) {
        text += 'Bring Runestones to\nthe Shrine of Dawn';
        this.questTrackerText.setColor('#ffd700');
    } else if (s.blightAwareness) {
        const count = s.runestoneStatus ? Object.values(s.runestoneStatus).filter(v => v).length : 0;
        text += `Find Runestones (${count}/3)\n`;
        
        if (!s.runestoneStatus?.forest_cave) text += '- Forest Cave (Needs Lantern)\n';
        if (!s.runestoneStatus?.abandoned_mine) text += '- Mine (Needs Rope)\n';
        if (!s.runestoneStatus?.ruined_tower) text += '- Tower (Needs Blade)';
        
        this.questTrackerText.setColor('#ffffff');
    } else {
        text += 'Talk to Rose at the Inn\nabout Aldric\'s journal';
        this.questTrackerText.setColor('#cccccc');
    }

    this.questTrackerText.setText(text);
  }

  private toggleHelp(): void {
    this.helpVisible = !this.helpVisible;
    this.helpPanel.setVisible(this.helpVisible);
  }

  private createHelpPanel(): void {
    this.helpPanel = this.add.container(0, 0);
    this.helpPanel.setDepth(200);
    this.helpPanel.setVisible(false);

    // Semi-transparent background
    const bg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH * 0.9,
      GAME_HEIGHT * 0.9,
      0x000000,
      0.85
    );
    bg.setStrokeStyle(2, 0xffd700);
    this.helpPanel.add(bg);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.1, '📜 Help — Controls & Guide', {
      fontSize: '24px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    this.helpPanel.add(title);

    // Content Style
    const headerStyle = {
      fontSize: '16px',
      color: '#ffd700',
      fontStyle: 'bold',
      resolution: window.devicePixelRatio,
    };
    
    const bodyStyle = {
      fontSize: '13px',
      color: '#ffffff',
      lineSpacing: 6,
      resolution: window.devicePixelRatio,
    };

    const tipStyle = {
      fontSize: '13px',
      color: '#cccccc',
      lineSpacing: 4,
      fontStyle: 'italic',
      resolution: window.devicePixelRatio,
    };

    // Columns
    const leftX = GAME_WIDTH * 0.15;
    const rightX = GAME_WIDTH * 0.55;
    const startY = GAME_HEIGHT * 0.2;

    // Controls
    this.helpPanel.add(this.add.text(leftX, startY, 'MOVEMENT', headerStyle));
    this.helpPanel.add(this.add.text(leftX, startY + 25, 'WASD / Arrows\n← ↑ → ↓', bodyStyle));

    this.helpPanel.add(this.add.text(leftX + 200, startY, 'ACTIONS', headerStyle));
    this.helpPanel.add(this.add.text(leftX + 200, startY + 25, 
      'E — Talk to NPC\nI — Open Inventory\nSpace — Attack\nH — Toggle Help\nESC — Close Menu', 
      bodyStyle
    ));

    // Gameplay
    const gameplayY = startY + 140;
    this.helpPanel.add(this.add.text(leftX, gameplayY, 'GAMEPLAY', headerStyle));
    this.helpPanel.add(this.add.text(leftX, gameplayY + 25,
      '• Walk near NPCs and press E to talk\n' +
      '• Build trust through conversations\n' +
      '• Explore east to find dungeon entrances\n' +
      '• Collect items to access dungeons:\n' +
      '  - Lantern → Forest Cave\n' +
      '  - Rope → Abandoned Mine\n' +
      '  - Enchanted Blade → Ruined Tower\n' +
      '• Find 3 Runestones to activate the Shrine of Dawn\n' +
      '• Watch out for wolves in the woods!',
      bodyStyle
    ));

    // Quest Tips
    this.helpPanel.add(this.add.text(rightX, gameplayY, 'QUEST TIPS', headerStyle));
    this.helpPanel.add(this.add.text(rightX, gameplayY + 25,
      '• Talk to Rose at the Inn about Aldric\'s journal\n' +
      '• Erik can forge tools if you bring him iron\n' +
      '• Willow brews potions from moonpetal herbs\n' +
      '• Marcus knows tactical routes but needs high trust\n' +
      '• Build relationships — NPCs remember everything!',
      tipStyle
    ));

    // Footer
    const footer = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.85, 'Press H to close', {
      fontSize: '14px',
      color: '#888888',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    this.helpPanel.add(footer);
  }
}
