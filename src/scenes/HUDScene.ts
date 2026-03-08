import Phaser from 'phaser';
import { WorldState } from '../world/WorldState';
import { LLMClient } from '../ai/LLMClient';
import { ITEMS } from '../inventory/types';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT, NPC_COLORS, fs, fsn } from '../config';
import { GameState } from '../world/GameState';

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
  private minimapKey!: Phaser.Input.Keyboard.Key;
  private barHeight = 48;
  private levelText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Rectangle;
  private xpBarFill!: Phaser.GameObjects.Rectangle;

  // Minimap
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapPlayerDot!: Phaser.GameObjects.Arc;
  private minimapZoneElements: Phaser.GameObjects.GameObject[] = [];
  private currentMinimapZone = '';
  private minimapVisible = true;
  private static readonly MM_W = 160;
  private static readonly MM_H = 120;

  constructor() {
    super({ key: 'HUDScene' });
    this.loadShownHints();
  }

  init(data: HUDData): void {
    this.worldState = data.worldState;
    this.llmClient = data.llmClient;
  }

  create(): void {
    const barH = Math.max(48, fsn(34) + 16);
    this.barHeight = barH;
    const barCenterY = barH / 2;
    const textY = Math.round((barH - fsn(34)) / 2);

    this.add.rectangle(GAME_WIDTH / 2, barCenterY, GAME_WIDTH, barH, 0x000000, 0.6).setDepth(100);

    this.timeText = this.add.text(10, textY, '06:00', {
      fontSize: fs(34),
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.timeText.setDepth(101);

    this.dayText = this.add.text(0, textY, 'Day 1', {
      fontSize: fs(34),
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.dayText.setDepth(101);
    this.dayText.setX(this.timeText.x + this.timeText.width + 12);

    this.levelText = this.add.text(0, textY, 'Lv.1', {
      fontSize: fs(34),
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.levelText.setDepth(101);

    const xpBarY = barH + 1;
    this.xpBarBg = this.add.rectangle(0, xpBarY, GAME_WIDTH, 4, 0x333333);
    this.xpBarBg.setOrigin(0, 0);
    this.xpBarBg.setDepth(100);
    this.xpBarFill = this.add.rectangle(0, xpBarY, 0, 4, 0x44ff88);
    this.xpBarFill.setOrigin(0, 0);
    this.xpBarFill.setDepth(101);

    const settingsBtn = this.add.text(GAME_WIDTH - 10, textY, '\u2699\uFE0F', {
      fontSize: fs(42),
      resolution: window.devicePixelRatio,
    });
    settingsBtn.setOrigin(1, 0);
    settingsBtn.setDepth(101);
    settingsBtn.setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerdown', () => {
      if (!this.scene.isActive('SettingsScene')) {
        this.scene.launch('SettingsScene', { onClose: () => {} });
      }
    });
    settingsBtn.on('pointerover', () => settingsBtn.setScale(1.1));
    settingsBtn.on('pointerout', () => settingsBtn.setScale(1));

    const hasApi = this.llmClient.hasApiKey();
    this.apiStatus = this.add.text(settingsBtn.x - settingsBtn.width - 8, textY, hasApi ? '\uD83D\uDFE2 LLM' : '\uD83D\uDFE1 Fallback', {
      fontSize: fs(26),
      color: hasApi ? '#44ff44' : '#ffaa00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.apiStatus.setOrigin(1, 0);
    this.apiStatus.setDepth(101);

    this.questTrackerText = this.add.text(GAME_WIDTH - 10, barH + 4, '', {
      fontSize: fs(24),
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'right',
      wordWrap: { width: 260 },
      resolution: window.devicePixelRatio,
    });
    this.questTrackerText.setOrigin(1, 0);
    this.questTrackerText.setDepth(101);
    this.updateQuestTracker();

    this.equippedWeaponText = this.add.text(10, GAME_HEIGHT - fsn(30) - 8, 'Weapon: (none)', {
      fontSize: fs(30),
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    }).setDepth(101);

    this.notificationText = this.add.text(GAME_WIDTH / 2, barH + 4, '', {
      fontSize: fs(28),
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000088',
      padding: { x: 16, y: 8 },
      wordWrap: { width: GAME_WIDTH * 0.7 },
      resolution: window.devicePixelRatio,
    });
    this.notificationText.setOrigin(0.5, 0);
    this.notificationText.setDepth(101);
    this.notificationText.setVisible(false);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 10, 'WASD: Move | E: Talk | I: Inv | C: Craft | T: Trade | M: Map | H: Help', {
        fontSize: fs(22),
        color: '#666666',
        stroke: '#000000',
        strokeThickness: 1,
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5, 1)
      .setDepth(101);

    this.createMinimap();

    EventBus.on(Events.SHOW_NOTIFICATION, this.onShowNotification, this);
    EventBus.on(Events.DIALOGUE_START, this.onDialogueStart, this);
    EventBus.on(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
    EventBus.on(Events.ITEM_ACQUIRED, this.onItemAcquired, this);
    EventBus.on(Events.PLAYER_ATTACK, this.onPlayerAttack, this);
    EventBus.on(Events.ITEM_CRAFTED, this.onItemCrafted, this);
    EventBus.on(Events.TRADE_COMPLETE, this.onTradeComplete, this);
    EventBus.on(Events.QUEST_PROGRESS, this.onQuestProgress, this);
    EventBus.on(Events.ENTITY_DAMAGED, this.onEntityDamaged, this);
    EventBus.on(Events.XP_GAINED, this.onXPGained, this);
    EventBus.on(Events.LEVEL_UP, this.onLevelUp, this);

    this.helpKey = this.input.keyboard!.addKey('H');
    this.helpKey.on('down', () => this.toggleHelp());
    this.minimapKey = this.input.keyboard!.addKey('M');
    this.minimapKey.on('down', () => this.toggleMinimap());
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

    this.updateLevelDisplay();
  }

  update(_time: number, delta: number): void {
    this.timeText.setText(`\uD83D\uDD50 ${this.worldState.getTimeString()}`);
    this.dayText.setText(`\uD83D\uDCC5 Day ${this.worldState.getDay()}`);
    this.dayText.setX(this.timeText.x + this.timeText.width + 12);
    this.levelText.setX(this.dayText.x + this.dayText.width + 12);

    if (this.time.now % 1000 < delta) {
      this.updateQuestTracker();
    }

    if (this.notificationTimer > 0) {
      this.notificationTimer -= delta;
      if (this.notificationTimer <= 0) {
        this.notificationText.setVisible(false);
      }
    }

    this.updateMinimap();
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
    EventBus.off(Events.XP_GAINED, this.onXPGained, this);
    EventBus.off(Events.LEVEL_UP, this.onLevelUp, this);
    if (this.helpKey) {
      this.helpKey.removeAllListeners();
    }
    if (this.minimapKey) {
      this.minimapKey.removeAllListeners();
    }
  }

  private onShowNotification(data: string | { message?: string; text?: string }): void {
    if (!this.scene.isActive()) return;
    if (typeof data === 'string') {
      this.showNotification(data);
    } else {
      // handles both `message` and `text` field variants from different event emitters
      this.showNotification(data.message ?? data.text ?? '');
    }
  }

  private onDialogueStart(data: { npc: { persona: { name: string } } }): void {
    if (!this.scene.isActive()) return;
    this.showNotification(`Speaking with ${data.npc.persona.name}...`);
    this.showHint('dialogue', 'Build trust by having more conversations. NPCs share knowledge as trust grows.');
  }

  private onInventoryChange(data: { equipped: Record<string, string | null> }): void {
    if (!this.scene.isActive() || !this.equippedWeaponText?.active) return;
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
    if (!this.scene.isActive()) return;
    const def = ITEMS[data.itemId];
    if (def) {
      const qtyStr = data.quantity > 1 ? ` x${data.quantity}` : '';
      this.showNotification(`Acquired: ${def.name}${qtyStr}`);
      this.showHint('inventory_usage', 'Press I to manage items. Equip weapons and gather materials for NPCs.');
      this.updateQuestTracker();
    }
  }

  private onPlayerAttack(): void {
    if (!this.scene.isActive()) return;
    this.showHint('combat', 'Press SPACE to attack! Watch your health bar.');
  }

  private onItemCrafted(): void {
    if (!this.scene.isActive()) return;
    this.showHint('crafting_success', 'Item crafted! Visit the Forge for advanced recipes.');
  }

  private onTradeComplete(): void {
    if (!this.scene.isActive()) return;
    this.showHint('trading', 'Trade with NPCs using T. Build trust for better prices and rare items.');
  }

  private onQuestProgress(): void {
    if (!this.scene.isActive()) return;
    this.updateQuestTracker();
  }

  private onEntityDamaged(data: { entity: string; currentHealth: number; maxHealth: number }): void {
    if (!this.scene.isActive()) return;
    if (data.entity === 'player' && data.currentHealth < data.maxHealth * 0.3) {
      this.showHint('low_health', 'Your health is low! Find safety or eat provisions.');
    }
  }

  private onXPGained(_data: { xp: number; totalXP: number; level: number }): void {
    if (!this.scene.isActive()) return;
    this.updateLevelDisplay();
  }

  private onLevelUp(data: { level: number }): void {
    if (!this.scene.isActive()) return;
    this.updateLevelDisplay();
    this.cameras.main.flash(300, 68, 255, 68);
    EventBus.emit(Events.SHOW_NOTIFICATION, { message: `Level Up! You are now level ${data.level}!` });
  }

  private updateLevelDisplay(): void {
    const gs = GameState.get(this);
    this.levelText.setText(`Lv.${gs.playerLevel}`);
    this.levelText.setX(this.dayText.x + this.dayText.width + 12);

    const xpRatio = gs.playerXP / gs.getXPForNextLevel();
    this.xpBarFill.setSize(GAME_WIDTH * xpRatio, 4);
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

    const hintY = this.barHeight + 10 + fsn(28);
    const hintText = this.add.text(GAME_WIDTH / 2, hintY, '\uD83D\uDCA1 ' + message, {
      fontSize: fs(28),
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: GAME_WIDTH * 0.6 },
      resolution: window.devicePixelRatio,
    });
    hintText.setOrigin(0.5);
    hintText.setDepth(151);

    const hintBg = this.add.rectangle(GAME_WIDTH / 2, hintY, Math.min(hintText.width + 32, GAME_WIDTH - 40), hintText.height + 16, 0x1a3366, 0.9);
    hintBg.setStrokeStyle(1, 0x4488ff);
    hintBg.setDepth(150);

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

    const gs = GameState.get(this);
    if (!gs) return;
    const s = gs.storylineManager;

    let text = 'Current Objective:\n';

    if (s.shrineActivated) {
        text += '✓ Shrine Activated!\nThe Blight is sealed.';
        this.questTrackerText.setColor('#44ff44');
    } else if (s.canActivateShrine()) {
        text += 'Bring Runestones to\nthe Shrine of Dawn';
        this.questTrackerText.setColor('#ffd700');
    } else if (s.blightAwareness) {
        const count = s.getRunestoneCount();
        text += `Find Runestones (${count}/3)\n`;

        if (!s.runestoneStatus.forest_cave?.runestoneObtained) text += '- Forest Cave (Needs Lantern)\n';
        if (!s.runestoneStatus.abandoned_mine?.runestoneObtained) text += '- Mine (Needs Rope)\n';
        if (!s.runestoneStatus.ruined_tower?.runestoneObtained) text += '- Tower (Needs Blade)';

        this.questTrackerText.setColor('#ffffff');
    } else {
        text += 'Explore Thornwick Village\n\u2022 Pick up items (E key)\n\u2022 Talk to villagers\n\u2022 Find Aldric\'s journal pages';
        this.questTrackerText.setColor('#cccccc');
    }

    this.questTrackerText.setText(text);
  }

  // --- Minimap ---

  private createMinimap(): void {
    const mmX = GAME_WIDTH - HUDScene.MM_W - 10;
    const mmY = GAME_HEIGHT - HUDScene.MM_H - 20;

    this.minimapContainer = this.add.container(mmX, mmY);
    this.minimapContainer.setDepth(101);

    const bg = this.add.rectangle(
      HUDScene.MM_W / 2, HUDScene.MM_H / 2,
      HUDScene.MM_W, HUDScene.MM_H,
      0x111122, 0.8
    );
    bg.setStrokeStyle(1, 0x4488ff);
    this.minimapContainer.add(bg);

    const label = this.add.text(HUDScene.MM_W / 2, -8, '[M] Map', {
      fontSize: fs(18),
      color: '#4488ff',
      stroke: '#000000',
      strokeThickness: 1,
      resolution: window.devicePixelRatio,
    });
    label.setOrigin(0.5, 1);
    this.minimapContainer.add(label);

    this.minimapPlayerDot = this.add.circle(
      HUDScene.MM_W / 2, HUDScene.MM_H / 2, 3, 0xffffff
    );
    this.minimapPlayerDot.setDepth(1);
    this.minimapContainer.add(this.minimapPlayerDot);
  }

  private toggleMinimap(): void {
    this.minimapVisible = !this.minimapVisible;
    this.minimapContainer.setVisible(this.minimapVisible);
  }

  private updateMinimap(): void {
    if (!this.minimapVisible) return;

    const gs = GameState.get(this);
    if (!gs) return;

    if (gs.currentZone !== this.currentMinimapZone) {
      this.rebuildMinimapForZone(gs.currentZone);
      this.currentMinimapZone = gs.currentZone;
    }

    const scaleX = HUDScene.MM_W / GAME_WIDTH;
    const scaleY = HUDScene.MM_H / GAME_HEIGHT;
    this.minimapPlayerDot.setPosition(
      gs.playerPosition.x * scaleX,
      gs.playerPosition.y * scaleY
    );
  }

  private rebuildMinimapForZone(zone: string): void {
    for (const el of this.minimapZoneElements) {
      el.destroy();
    }
    this.minimapZoneElements = [];

    const scaleX = HUDScene.MM_W / GAME_WIDTH;
    const scaleY = HUDScene.MM_H / GAME_HEIGHT;

    if (zone === 'village') {
      this.buildVillageMinimap(scaleX, scaleY);
    } else if (zone === 'woods') {
      this.buildWoodsMinimap(scaleX, scaleY);
    } else if (zone === 'dungeon') {
      this.buildDungeonMinimap();
    } else {
      this.buildGenericMinimap(zone);
    }
  }

  private buildVillageMinimap(sx: number, sy: number): void {
    const buildings: { x: number; y: number; w: number; h: number; color: number }[] = [
      { x: 368, y: 288, w: 80, h: 60, color: 0xcc4400 },
      { x: 704, y: 288, w: 90, h: 70, color: 0xbb8844 },
      { x: 592, y: 464, w: 70, h: 50, color: 0x6644aa },
      { x: 1024, y: 688, w: 100, h: 60, color: 0x558833 },
      { x: 160, y: 560, w: 60, h: 50, color: 0x666688 },
      { x: 800, y: 160, w: 70, h: 50, color: 0x339966 },
    ];

    for (const b of buildings) {
      const rect = this.add.rectangle(
        b.x * sx, b.y * sy,
        Math.max(b.w * sx, 4), Math.max(b.h * sy, 3),
        b.color, 0.9
      );
      this.minimapContainer.add(rect);
      this.minimapZoneElements.push(rect);
    }

    const shrine = this.add.circle(640 * sx, 96 * sy, 2, 0xffd700);
    this.minimapContainer.add(shrine);
    this.minimapZoneElements.push(shrine);

    const npcPositions: { x: number; y: number; id: string }[] = [
      { x: 368, y: 288, id: 'blacksmith_erik' },
      { x: 704, y: 288, id: 'innkeeper_rose' },
      { x: 592, y: 464, id: 'merchant_anna' },
      { x: 1024, y: 688, id: 'farmer_thomas' },
      { x: 160, y: 560, id: 'guard_marcus' },
      { x: 800, y: 160, id: 'herbalist_willow' },
    ];

    for (const npc of npcPositions) {
      const color = NPC_COLORS[npc.id] ?? 0xaaaaaa;
      const dot = this.add.circle(npc.x * sx, npc.y * sy, 2, color);
      this.minimapContainer.add(dot);
      this.minimapZoneElements.push(dot);
    }

    const exitLine = this.add.rectangle(
      HUDScene.MM_W - 1, HUDScene.MM_H / 2,
      2, 20, 0x44ff44
    );
    this.minimapContainer.add(exitLine);
    this.minimapZoneElements.push(exitLine);
    this.tweens.add({
      targets: exitLine,
      alpha: { from: 0.3, to: 1.0 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private buildWoodsMinimap(sx: number, sy: number): void {
    const entrances: { x: number; y: number; color: number }[] = [
      { x: 1200, y: 300, color: 0x1a3a0a },
      { x: 1100, y: 800, color: 0x3a3a3a },
      { x: 800, y: 150, color: 0x3a0a3a },
    ];

    for (const ent of entrances) {
      const dot = this.add.circle(ent.x * sx, ent.y * sy, 3, ent.color);
      dot.setStrokeStyle(1, 0xffffff, 0.5);
      this.minimapContainer.add(dot);
      this.minimapZoneElements.push(dot);
    }

    const exitLine = this.add.rectangle(
      1, HUDScene.MM_H / 2,
      2, 20, 0x44ff44
    );
    this.minimapContainer.add(exitLine);
    this.minimapZoneElements.push(exitLine);
    this.tweens.add({
      targets: exitLine,
      alpha: { from: 0.3, to: 1.0 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private buildDungeonMinimap(): void {
    const label = this.add.text(HUDScene.MM_W / 2, HUDScene.MM_H / 2 - 10, 'Dungeon', {
      fontSize: fs(20),
      color: '#ff6644',
      resolution: window.devicePixelRatio,
    });
    label.setOrigin(0.5);
    this.minimapContainer.add(label);
    this.minimapZoneElements.push(label);
  }

  private buildGenericMinimap(zone: string): void {
    const label = this.add.text(HUDScene.MM_W / 2, HUDScene.MM_H / 2 - 10, zone.replace('_', ' '), {
      fontSize: fs(20),
      color: '#88aaff',
      resolution: window.devicePixelRatio,
    });
    label.setOrigin(0.5);
    this.minimapContainer.add(label);
    this.minimapZoneElements.push(label);
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
    
    const colWidth = GAME_WIDTH * 0.35;
    const bodyStyle = {
      fontSize: fs(28),
      color: '#ffffff',
      lineSpacing: 6,
      wordWrap: { width: colWidth },
      resolution: window.devicePixelRatio,
    };

    const tipStyle = {
      fontSize: fs(28),
      color: '#cccccc',
      lineSpacing: 4,
      fontStyle: 'italic' as const,
      wordWrap: { width: colWidth },
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
