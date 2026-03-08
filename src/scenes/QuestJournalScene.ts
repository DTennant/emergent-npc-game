import Phaser from 'phaser';
import { GameState } from '../world/GameState';
import { JOURNAL_PAGES } from '../story/AldricJournal';
import { QUEST_GATES, QuestGateChecker } from '../quest/QuestGates';
import { NPC_PERSONAS } from '../npc/personas';
import { ITEMS } from '../inventory/types';
import { GAME_WIDTH, GAME_HEIGHT, fs, fsn } from '../config';

const PANEL_W = 950;
const PANEL_H = 720;
const PANEL_X = GAME_WIDTH / 2;
const PANEL_Y = GAME_HEIGHT / 2;
const PANEL_LEFT = PANEL_X - PANEL_W / 2;
const PANEL_TOP = PANEL_Y - PANEL_H / 2;
const CONTENT_X = PANEL_LEFT + 30;
const CONTENT_Y = PANEL_TOP + 110;
const CONTENT_W = PANEL_W - 60;

const TAB_NAMES = ['Journal', 'Dungeons', 'NPCs'];
const DUNGEON_INFO: Record<string, { name: string; requiredItem: string }> = {
  forest_cave: { name: 'Forest Cave', requiredItem: 'lantern' },
  abandoned_mine: { name: 'Abandoned Mine', requiredItem: 'rope' },
  ruined_tower: { name: 'Ruined Tower', requiredItem: 'enchanted_blade' },
};

export class QuestJournalScene extends Phaser.Scene {
  private activeTab = 0;
  private tabContainers: Phaser.GameObjects.Container[] = [];
  private tabButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'QuestJournalScene' });
  }

  create(): void {
    this.activeTab = 0;
    this.tabContainers = [];
    this.tabButtons = [];

    this.createBackdrop();
    this.createPanel();
    this.createTabButtons();
    this.createJournalTab();
    this.createDungeonTab();
    this.createNPCTab();
    this.switchTab(0);
    this.setupInput();
  }

  private createBackdrop(): void {
    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.85
    ).setDepth(50).setInteractive();
    backdrop.on('pointerdown', () => { /* absorb clicks */ });
  }

  private createPanel(): void {
    this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xddaa44)
      .setDepth(51);

    this.add.text(PANEL_X, PANEL_TOP + 25, 'Quest Journal', {
      fontSize: fs(28),
      color: '#ddaa44',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5, 0).setDepth(52);

    this.add.text(PANEL_X, PANEL_TOP + PANEL_H - 20, 'Press J or ESC to close', {
      fontSize: fs(12),
      color: '#666666',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5, 1).setDepth(52);
  }

  private createTabButtons(): void {
    const tabY = PANEL_TOP + 65;
    const tabW = 120;
    const tabGap = 10;
    const totalW = TAB_NAMES.length * tabW + (TAB_NAMES.length - 1) * tabGap;
    const startX = PANEL_X - totalW / 2 + tabW / 2;

    for (let i = 0; i < TAB_NAMES.length; i++) {
      const x = startX + i * (tabW + tabGap);
      const btn = this.add.text(x, tabY, TAB_NAMES[i], {
        fontSize: fs(16),
        color: '#888888',
        backgroundColor: '#333333',
        padding: { x: 16, y: 8 },
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5).setDepth(53).setInteractive();

      btn.on('pointerdown', () => this.switchTab(i));
      btn.on('pointerover', () => btn.setAlpha(0.8));
      btn.on('pointerout', () => btn.setAlpha(1));
      this.tabButtons.push(btn);
    }
  }

  private switchTab(index: number): void {
    this.activeTab = index;
    this.tabContainers.forEach((c, i) => c.setVisible(i === index));
    this.tabButtons.forEach((btn, i) => {
      if (i === index) {
        btn.setBackgroundColor('#ddaa44');
        btn.setColor('#1a1a2e');
      } else {
        btn.setBackgroundColor('#333333');
        btn.setColor('#888888');
      }
    });
  }

  // --- Tab 1: Journal Pages ---
  private createJournalTab(): void {
    const container = this.add.container(0, 0).setDepth(52);
    const gs = GameState.get(this);
    let y = CONTENT_Y;

    const sectionTitle = this.add.text(CONTENT_X, y, "Sage Aldric's Journal", {
      fontSize: fs(20),
      color: '#ddaa44',
      resolution: window.devicePixelRatio,
    });
    container.add(sectionTitle);
    y += fsn(20) + 15;

    for (const page of JOURNAL_PAGES) {
      const discovered = gs.aldricJournal.isDiscovered(page.id);

      if (discovered) {
        const titleText = this.add.text(CONTENT_X + 10, y, page.title, {
          fontSize: fs(16),
          color: '#ddaa44',
          fontStyle: 'bold',
          resolution: window.devicePixelRatio,
        });
        container.add(titleText);
        y += fsn(16) + 6;

        const contentStr = page.content.length > 120
          ? page.content.substring(0, 120) + '...'
          : page.content;
        const contentText = this.add.text(CONTENT_X + 20, y, contentStr, {
          fontSize: fs(13),
          color: '#cccccc',
          wordWrap: { width: CONTENT_W - 40 },
          lineSpacing: 3,
          resolution: window.devicePixelRatio,
        });
        container.add(contentText);
        y += contentText.height + 15;
      } else {
        const unknownText = this.add.text(CONTENT_X + 10, y, '??? Unknown Page', {
          fontSize: fs(16),
          color: '#555555',
          fontStyle: 'italic',
          resolution: window.devicePixelRatio,
        });
        container.add(unknownText);
        y += fsn(16) + 20;
      }
    }

    this.tabContainers.push(container);
  }

  // --- Tab 2: Dungeon Status ---
  private createDungeonTab(): void {
    const container = this.add.container(0, 0).setDepth(52);
    const gs = GameState.get(this);
    const dungeonIds = ['forest_cave', 'abandoned_mine', 'ruined_tower'];
    const cardW = 260;
    const cardH = 300;
    const cardGap = 20;
    const totalCardsW = dungeonIds.length * cardW + (dungeonIds.length - 1) * cardGap;
    const cardsStartX = PANEL_X - totalCardsW / 2 + cardW / 2;
    const cardY = CONTENT_Y + 30 + cardH / 2;

    for (let i = 0; i < dungeonIds.length; i++) {
      const dungeonId = dungeonIds[i];
      const info = DUNGEON_INFO[dungeonId];
      const status = gs.storylineManager.runestoneStatus[dungeonId];
      const x = cardsStartX + i * (cardW + cardGap);

      const borderColor = status?.dungeonCleared ? 0x44cc44
        : status?.discovered ? 0xddaa44
        : 0x555555;

      const cardBg = this.add.rectangle(x, cardY, cardW, cardH, 0x222244, 0.9)
        .setStrokeStyle(2, borderColor);
      container.add(cardBg);

      let cy = cardY - cardH / 2 + 20;

      const nameText = this.add.text(x, cy, info.name, {
        fontSize: fs(18),
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5, 0);
      container.add(nameText);
      cy += fsn(18) + 15;

      const hasItem = gs.inventory.hasItem(info.requiredItem);
      const itemDef = ITEMS[info.requiredItem];
      const itemName = itemDef?.name ?? info.requiredItem;
      const reqText = this.add.text(x, cy, `Required: ${itemName} ${hasItem ? '✓' : '✗'}`, {
        fontSize: fs(13),
        color: hasItem ? '#44cc44' : '#cc4444',
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5, 0);
      container.add(reqText);
      cy += fsn(13) + 20;

      const checks = [
        { label: 'Discovered', done: status?.discovered ?? false },
        { label: 'NPC Helped', done: status?.npcHelped ?? false },
        { label: 'Cleared', done: status?.dungeonCleared ?? false },
        { label: 'Runestone', done: status?.runestoneObtained ?? false },
      ];

      for (const check of checks) {
        const icon = check.done ? '☑' : '☐';
        const color = check.done ? '#44cc44' : '#666666';
        const checkText = this.add.text(x - cardW / 2 + 30, cy, `${icon} ${check.label}`, {
          fontSize: fs(14),
          color,
          resolution: window.devicePixelRatio,
        });
        container.add(checkText);
        cy += fsn(14) + 8;
      }
    }

    // Runestone progress
    const progressY = cardY + cardH / 2 + 30;
    const runestoneCount = gs.storylineManager.getRunestoneCount();

    const progressText = this.add.text(PANEL_X - 80, progressY, `Runestones: ${runestoneCount}/3`, {
      fontSize: fs(18),
      color: '#ddaa44',
      resolution: window.devicePixelRatio,
    }).setOrigin(0, 0.5);
    container.add(progressText);

    for (let i = 0; i < 3; i++) {
      const cx = PANEL_X + 60 + i * 30;
      const filled = i < runestoneCount;
      const circle = this.add.circle(cx, progressY, 10, filled ? 0xddaa44 : 0x333333)
        .setStrokeStyle(2, 0xddaa44);
      container.add(circle);
    }

    // Shrine status
    const shrineY = progressY + 35;
    const shrineLabel = gs.storylineManager.shrineActivated ? 'Activated ✓'
      : gs.storylineManager.canActivateShrine() ? 'Ready to Activate'
      : 'Sealed';
    const shrineColor = gs.storylineManager.shrineActivated ? '#44cc44'
      : gs.storylineManager.canActivateShrine() ? '#ddaa44'
      : '#888888';
    const shrineText = this.add.text(PANEL_X, shrineY, `Shrine of Dawn: ${shrineLabel}`, {
      fontSize: fs(16),
      color: shrineColor,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5, 0);
    container.add(shrineText);

    this.tabContainers.push(container);
  }

  // --- Tab 3: NPC Cooperation ---
  private createNPCTab(): void {
    const container = this.add.container(0, 0).setDepth(52);
    const gs = GameState.get(this);
    const cols = 3;
    const cardW = 270;
    const cardH = 180;
    const cardGapX = 20;
    const cardGapY = 15;
    const totalW = cols * cardW + (cols - 1) * cardGapX;
    const startX = PANEL_X - totalW / 2 + cardW / 2;
    const startY = CONTENT_Y + 20 + cardH / 2;

    for (let i = 0; i < NPC_PERSONAS.length; i++) {
      const persona = NPC_PERSONAS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + cardGapX);
      const y = startY + row * (cardH + cardGapY);

      const cardBg = this.add.rectangle(x, y, cardW, cardH, 0x222244, 0.9)
        .setStrokeStyle(1, 0x445566);
      container.add(cardBg);

      let cy = y - cardH / 2 + 15;

      // Name + role
      const nameText = this.add.text(x, cy, `${persona.name} — ${persona.role}`, {
        fontSize: fs(15),
        color: '#ddaa44',
        fontStyle: 'bold',
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5, 0);
      container.add(nameText);
      cy += fsn(15) + 12;

      // Get relationship data
      const npcSave = gs.npcData.get(persona.id);
      const trust = npcSave?.memory?.social?.['player']?.trust ?? 0.5;
      const familiarity = npcSave?.memory?.social?.['player']?.familiarity ?? 0;

      // Trust bar
      const barX = x - cardW / 2 + 25;
      const barW = cardW - 50;
      const barH = 12;

      const trustLabel = this.add.text(barX, cy, 'Trust:', {
        fontSize: fs(11),
        color: '#aaaaaa',
        resolution: window.devicePixelRatio,
      });
      container.add(trustLabel);
      cy += fsn(11) + 4;

      const trustBg = this.add.rectangle(barX + barW / 2, cy + barH / 2, barW, barH, 0x333333)
        .setStrokeStyle(1, 0x555555);
      container.add(trustBg);
      const trustFillW = Math.max(2, barW * Math.min(1, trust));
      const trustColor = trust >= 0.6 ? 0x44cc44 : trust >= 0.4 ? 0xddaa44 : 0xcc4444;
      const trustFill = this.add.rectangle(barX + trustFillW / 2, cy + barH / 2, trustFillW, barH - 2, trustColor);
      container.add(trustFill);
      const trustValText = this.add.text(barX + barW + 5, cy, `${Math.round(trust * 100)}%`, {
        fontSize: fs(10),
        color: '#aaaaaa',
        resolution: window.devicePixelRatio,
      });
      container.add(trustValText);
      cy += barH + 8;

      // Familiarity bar
      const famLabel = this.add.text(barX, cy, 'Familiarity:', {
        fontSize: fs(11),
        color: '#aaaaaa',
        resolution: window.devicePixelRatio,
      });
      container.add(famLabel);
      cy += fsn(11) + 4;

      const famBg = this.add.rectangle(barX + barW / 2, cy + barH / 2, barW, barH, 0x333333)
        .setStrokeStyle(1, 0x555555);
      container.add(famBg);
      const famFillW = Math.max(2, barW * Math.min(1, familiarity));
      const famColor = familiarity >= 0.5 ? 0x44cc44 : familiarity >= 0.3 ? 0xddaa44 : 0xcc4444;
      const famFill = this.add.rectangle(barX + famFillW / 2, cy + barH / 2, famFillW, barH - 2, famColor);
      container.add(famFill);
      const famValText = this.add.text(barX + barW + 5, cy, `${Math.round(familiarity * 100)}%`, {
        fontSize: fs(10),
        color: '#aaaaaa',
        resolution: window.devicePixelRatio,
      });
      container.add(famValText);
      cy += barH + 10;

      // Quest gate status
      const gates = QuestGateChecker.getGatesForNPC(persona.id);
      if (gates.length > 0) {
        const gate = gates[0];
        const gateStatus = QuestGateChecker.getGateStatus(persona.id, gate.questId, trust, familiarity);
        const statusStr = gateStatus.canHelp ? 'Ready to help ✓' : 'Not yet trusting';
        const statusColor = gateStatus.canHelp ? '#44cc44' : '#cc6644';
        const statusText = this.add.text(x, cy, statusStr, {
          fontSize: fs(12),
          color: statusColor,
          resolution: window.devicePixelRatio,
        }).setOrigin(0.5, 0);
        container.add(statusText);
      }
    }

    this.tabContainers.push(container);
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-J', () => this.scene.stop());
    this.input.keyboard!.on('keydown-ESC', () => this.scene.stop());
    this.input.keyboard!.on('keydown-ONE', () => this.switchTab(0));
    this.input.keyboard!.on('keydown-TWO', () => this.switchTab(1));
    this.input.keyboard!.on('keydown-THREE', () => this.switchTab(2));
  }
}
