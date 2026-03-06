import Phaser from 'phaser';
import { WorldState } from '../world/WorldState';
import { LLMClient } from '../ai/LLMClient';
import { ITEMS } from '../inventory/types';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT, fs } from '../config';

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
  private helpKey!: Phaser.Input.Keyboard.Key;

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
    this.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH, 48, 0x000000, 0.6).setDepth(100);

    // Time display
    this.timeText = this.add.text(10, 8, '06:00', {
      fontSize: fs(34),
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.timeText.setDepth(101);

    // Day display
    this.dayText = this.add.text(90, 8, 'Day 1', {
      fontSize: fs(34),
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.dayText.setDepth(101);

    // Quest Tracker
    this.questTrackerText = this.add.text(GAME_WIDTH - 120, 40, '', {
      fontSize: fs(24),
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
      fontSize: fs(26),
      color: hasApi ? '#44ff44' : '#ffaa00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.apiStatus.setOrigin(1, 0);
    this.apiStatus.setDepth(101);

    this.add
      .text(GAME_WIDTH / 2, 8, 'WASD: Move | E: Talk | I: Inv | C: Craft | T: Trade | ESC: Close', {
        fontSize: fs(26),
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5, 0)
      .setDepth(101);

    this.equippedWeaponText = this.add.text(10, GAME_HEIGHT - 30, 'Weapon: (none)', {
      fontSize: fs(30),
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    }).setDepth(101);

    // Notification area
    this.notificationText = this.add.text(GAME_WIDTH / 2, 40, '', {
      fontSize: fs(28),
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000088',
      padding: { x: 16, y: 8 },
      resolution: window.devicePixelRatio,
    });
    this.notificationText.setOrigin(0.5);
    this.notificationText.setDepth(101);
    this.notificationText.setVisible(false);

    const settingsBtn = this.add.text(GAME_WIDTH - 30, 6, '⚙️', {
      fontSize: fs(42),
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

    EventBus.on(Events.SHOW_NOTIFICATION, this.onShowNotification, this);
    EventBus.on(Events.DIALOGUE_START, this.onDialogueStart, this);
    EventBus.on(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
    EventBus.on(Events.ITEM_ACQUIRED, this.onItemAcquired, this);
    EventBus.on(Events.PLAYER_ATTACK, this.onPlayerAttack, this);
    EventBus.on(Events.ITEM_CRAFTED, this.onItemCrafted, this);
    EventBus.on(Events.TRADE_COMPLETE, this.onTradeComplete, this);
    EventBus.on(Events.QUEST_PROGRESS, this.onQuestProgress, this);
    EventBus.on(Events.ENTITY_DAMAGED, this.onEntityDamaged, this);

    this.helpKey = this.input.keyboard!.addKey('H');
    this.helpKey.on('down', () => this.toggleHelp());
    this.createHelpPanel();

    this.time.delayedCall(2000, () => {
      this.showHint('explore_village', 'Explore the village! Look for glowing items to pick up with E.');
    });
    this.time.delayedCall(8000, () => {
      this.showHint('talk_to_npcs', 'Talk to the villagers with E. Try Rose at the Inn — she knows about Sage Aldric.');
    });
    this.time.delayedCall(15000, () => {
      this.showHint('check_quest', 'Press H for help. Head east (\u2192) to find the Dark Woods when ready.');
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

  shutdown(): void {
    EventBus.off(Events.SHOW_NOTIFICATION, this.onShowNotification, this);
    EventBus.off(Events.DIALOGUE_START, this.onDialogueStart, this);
    EventBus.off(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
    EventBus.off(Events.ITEM_ACQUIRED, this.onItemAcquired, this);
    EventBus.off(Events.PLAYER_ATTACK, this.onPlayerAttack, this);
    EventBus.off(Events.ITEM_CRAFTED, this.onItemCrafted, this);
    EventBus.off(Events.TRADE_COMPLETE, this.onTradeComplete, this);
    EventBus.off(Events.QUEST_PROGRESS, this.onQuestProgress, this);
    EventBus.off(Events.ENTITY_DAMAGED, this.onEntityDamaged, this);
    if (this.helpKey) {
      this.helpKey.removeAllListeners();
    }
  }

  private onShowNotification(data: string | { message?: string; text?: string }): void {
    if (typeof data === 'string') {
      this.showNotification(data);
    } else {
      this.showNotification(data.message ?? data.text ?? '');
    }
  }

  private onDialogueStart(data: { npc: { persona: { name: string } } }): void {
    this.showNotification(`Speaking with ${data.npc.persona.name}...`);
    this.showHint('dialogue', 'Build trust by having more conversations. NPCs share knowledge as trust grows.');
  }

  private onInventoryChange(data: { equipped: Record<string, string | null> }): void {
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
  }

  private onItemAcquired(data: { itemId: string; quantity: number }): void {
    const def = ITEMS[data.itemId];
    if (def) {
      const qtyStr = data.quantity > 1 ? ` x${data.quantity}` : '';
      this.showNotification(`Acquired: ${def.name}${qtyStr}`);
      this.showHint('inventory_usage', 'Press I to manage items. Equip weapons and gather materials for NPCs.');
      this.updateQuestTracker();
    }
  }

  private onPlayerAttack(): void {
    this.showHint('combat', 'Press SPACE to attack! Watch your health bar.');
  }

  private onItemCrafted(): void {
    this.showHint('crafting_success', 'Item crafted! Visit the Forge for advanced recipes.');
  }

  private onTradeComplete(): void {
    this.showHint('trading', 'Trade with NPCs using T. Build trust for better prices and rare items.');
  }

  private onQuestProgress(): void {
    this.updateQuestTracker();
  }

  private onEntityDamaged(data: { entity: string; currentHealth: number; maxHealth: number }): void {
    if (data.entity === 'player' && data.currentHealth < data.maxHealth * 0.3) {
      this.showHint('low_health', 'Your health is low! Find safety or eat provisions.');
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

    const hintBg = this.add.rectangle(GAME_WIDTH / 2, 70, 500, 64, 0x1a3366, 0.9);
    hintBg.setStrokeStyle(1, 0x4488ff);
    hintBg.setDepth(150);

    const hintText = this.add.text(GAME_WIDTH / 2, 70, '💡 ' + message, {
      fontSize: fs(28),
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
        text += 'Explore Thornwick Village\n\u2022 Pick up items (E key)\n\u2022 Talk to villagers\n\u2022 Find Aldric\'s journal pages';
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
      fontSize: fs(48),
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    this.helpPanel.add(title);

    // Content Style
    const headerStyle = {
      fontSize: fs(34),
      color: '#ffd700',
      fontStyle: 'bold' as const,
      resolution: window.devicePixelRatio,
    };
    
    const bodyStyle = {
      fontSize: fs(28),
      color: '#ffffff',
      lineSpacing: 6,
      resolution: window.devicePixelRatio,
    };

    const tipStyle = {
      fontSize: fs(28),
      color: '#cccccc',
      lineSpacing: 4,
      fontStyle: 'italic' as const,
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
      'E — Talk to NPC\nI — Open Inventory\nC — Crafting Menu\nT — Trade (near NPC)\nSpace — Attack\nH — Toggle Help\nESC — Close Menu', 
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
      fontSize: fs(30),
      color: '#888888',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    this.helpPanel.add(footer);
  }
}
