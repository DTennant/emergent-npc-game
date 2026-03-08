import Phaser from 'phaser';
import { Inventory } from '../inventory/Inventory';
import { ITEMS } from '../inventory/types';
import { CombatSystem } from '../combat/CombatSystem';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT, fs } from '../config';

interface InventorySceneData {
  inventory: Inventory;
  combatSystem?: CombatSystem;
}

const GRID_COLS = 5;
const GRID_ROWS = 4;
const CELL_SIZE = 64;
const CELL_GAP = 8;
const GRID_X = 50;
const GRID_Y = 90;

const TYPE_COLORS: Record<string, number> = {
  weapon: 0xcc4444,
  tool: 0x4488cc,
  consumable: 0x44cc44,
  quest: 0xccaa44,
  material: 0x888888,
  armor: 0x6688bb,
};

export class InventoryScene extends Phaser.Scene {
  private inventory!: Inventory;
  private combatSystem: CombatSystem | null = null;
  private selectedIndex = -1;
  private itemCells: Phaser.GameObjects.Rectangle[] = [];
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private qtyTexts: Phaser.GameObjects.Text[] = [];
  private descriptionText!: Phaser.GameObjects.Text;
  private equipButton!: Phaser.GameObjects.Text;
  private useButton!: Phaser.GameObjects.Text;
  private selectionHighlight!: Phaser.GameObjects.Rectangle;
  private equippedTexts: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super({ key: 'InventoryScene' });
  }

  init(data: InventorySceneData): void {
    this.inventory = data.inventory;
    this.combatSystem = data.combatSystem ?? null;
    this.selectedIndex = -1;
    this.itemCells = [];
    this.itemTexts = [];
    this.qtyTexts = [];
  }

  create(): void {
    const backdrop = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.6
    );
    backdrop.setDepth(50);
    backdrop.setInteractive();

    const panel = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH - 60,
      GAME_HEIGHT - 60,
      0x1a1a2e,
      0.95
    );
    panel.setStrokeStyle(2, 0x4488ff);
    panel.setDepth(51);

    this.add.text(GAME_WIDTH / 2, 50, 'Inventory', {
      fontSize: fs(48),
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(52);

    this.createGrid();
    this.createEquipPanel();
    this.createDescriptionPanel();
    this.refreshDisplay();

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.stop();
    });

    this.input.keyboard!.on('keydown-I', () => {
      this.scene.stop();
    });
  }

  private createGrid(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = GRID_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
        const y = GRID_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
        const index = row * GRID_COLS + col;

        const cell = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, 0x2a2a4e, 0.8);
        cell.setStrokeStyle(1, 0x445566);
        cell.setDepth(52);
        cell.setInteractive();
        cell.on('pointerdown', () => this.selectItem(index));

        this.itemCells.push(cell);

        const nameText = this.add.text(x, y - 8, '', {
          fontSize: fs(24),
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: CELL_SIZE - 4 },
          resolution: window.devicePixelRatio,
        }).setOrigin(0.5).setDepth(53);
        this.itemTexts.push(nameText);

        const qtyText = this.add.text(x + CELL_SIZE / 2 - 4, y + CELL_SIZE / 2 - 4, '', {
          fontSize: fs(26),
          color: '#aaffaa',
          stroke: '#000000',
          strokeThickness: 2,
          resolution: window.devicePixelRatio,
        }).setOrigin(1, 1).setDepth(53);
        this.qtyTexts.push(qtyText);
      }
    }

    this.selectionHighlight = this.add.rectangle(0, 0, CELL_SIZE + 4, CELL_SIZE + 4);
    this.selectionHighlight.setStrokeStyle(2, 0xffcc00);
    this.selectionHighlight.setFillStyle(0xffcc00, 0.1);
    this.selectionHighlight.setDepth(52);
    this.selectionHighlight.setVisible(false);
  }

  private createEquipPanel(): void {
    const panelX = GRID_X + GRID_COLS * (CELL_SIZE + CELL_GAP) + 40;
    const panelY = GRID_Y;

    this.add.text(panelX, panelY, 'Equipped', {
      fontSize: fs(38),
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    }).setDepth(52);

    const slots = ['weapon', 'lantern', 'accessory'];
    const labels = ['Weapon', 'Lantern', 'Accessory'];

    for (let i = 0; i < slots.length; i++) {
      const slotY = panelY + 40 + i * 60;
      this.add.text(panelX, slotY, `${labels[i]}:`, {
        fontSize: fs(30),
        color: '#888888',
        resolution: window.devicePixelRatio,
      }).setDepth(52);

      const valueText = this.add.text(panelX, slotY + 20, '(empty)', {
        fontSize: fs(30),
        color: '#666666',
        resolution: window.devicePixelRatio,
      }).setDepth(52);
      this.equippedTexts[slots[i]] = valueText;
    }
  }

  private createDescriptionPanel(): void {
    const descY = GRID_Y + GRID_ROWS * (CELL_SIZE + CELL_GAP) + 30;

    this.descriptionText = this.add.text(GRID_X, descY, 'Select an item to see details.', {
      fontSize: fs(30),
      color: '#aaaaaa',
      wordWrap: { width: GAME_WIDTH - 120 },
      lineSpacing: 6,
      resolution: window.devicePixelRatio,
    }).setDepth(52);

    this.equipButton = this.add.text(GAME_WIDTH - 140, descY, '', {
      fontSize: fs(34),
      color: '#000000',
      backgroundColor: '#44cc44',
      padding: { x: 12, y: 8 },
      resolution: window.devicePixelRatio,
    }).setDepth(53).setInteractive().setVisible(false);

    this.equipButton.on('pointerdown', () => this.handleEquipClick());
    this.equipButton.on('pointerover', () => this.equipButton.setAlpha(0.8));
    this.equipButton.on('pointerout', () => this.equipButton.setAlpha(1));

    this.useButton = this.add.text(GAME_WIDTH - 260, descY, '  Use  ', {
      fontSize: fs(34),
      color: '#000000',
      backgroundColor: '#44aaff',
      padding: { x: 12, y: 8 },
      resolution: window.devicePixelRatio,
    }).setDepth(53).setInteractive().setVisible(false);

    this.useButton.on('pointerdown', () => this.handleUseClick());
    this.useButton.on('pointerover', () => this.useButton.setAlpha(0.8));
    this.useButton.on('pointerout', () => this.useButton.setAlpha(1));
  }

  private selectItem(index: number): void {
    const items = this.inventory.getItems();
    if (index >= items.length) {
      this.selectedIndex = -1;
      this.selectionHighlight.setVisible(false);
      this.descriptionText.setText('Select an item to see details.');
      this.equipButton.setVisible(false);
      this.useButton.setVisible(false);
      return;
    }

    this.selectedIndex = index;
    const slot = items[index];
    const def = ITEMS[slot.itemId];
    if (!def) {
      this.descriptionText.setText('Unknown item (corrupted save).');
      this.equipButton.setVisible(false);
      this.useButton.setVisible(false);
      return;
    }

    const cell = this.itemCells[index];
    this.selectionHighlight.setPosition(cell.x, cell.y);
    this.selectionHighlight.setVisible(true);

    let desc = `${def.name}\n${def.description}`;
    if (def.stats?.damage) desc += `\nDamage: ${def.stats.damage}`;
    if (def.stats?.defense) desc += `\nDefense: ${def.stats.defense}`;
    desc += `\nType: ${def.type}`;
    if (slot.quantity > 1) desc += ` | Qty: ${slot.quantity}`;
    this.descriptionText.setText(desc);

    if (def.equipSlot) {
      const currentlyEquipped = this.inventory.getEquipped(def.equipSlot);
      if (currentlyEquipped === def.id) {
        this.equipButton.setText(' Unequip ');
        this.equipButton.setBackgroundColor('#cc6644');
      } else {
        this.equipButton.setText('  Equip  ');
        this.equipButton.setBackgroundColor('#44cc44');
      }
      this.equipButton.setVisible(true);
    } else {
      this.equipButton.setVisible(false);
    }

    const isUsable = def.type === 'consumable';
    this.useButton.setVisible(isUsable);
  }

  private handleEquipClick(): void {
    const items = this.inventory.getItems();
    if (this.selectedIndex < 0 || this.selectedIndex >= items.length) return;

    const slot = items[this.selectedIndex];
    const def = ITEMS[slot.itemId];
    if (!def) return;
    if (!def.equipSlot) return;

    const currentlyEquipped = this.inventory.getEquipped(def.equipSlot);
    if (currentlyEquipped === def.id) {
      this.inventory.unequip(def.equipSlot);
    } else {
      this.inventory.equip(def.id);
    }

    this.refreshDisplay();
    this.selectItem(this.selectedIndex);
  }

  private handleUseClick(): void {
    const items = this.inventory.getItems();
    if (this.selectedIndex < 0 || this.selectedIndex >= items.length) return;

    const slot = items[this.selectedIndex];
    if (!this.combatSystem) {
      EventBus.emit(Events.SHOW_NOTIFICATION, { message: 'Cannot use items right now.' });
      return;
    }

    const success = this.combatSystem.useConsumable(slot.itemId, this.inventory);
    if (success) {
      const def = ITEMS[slot.itemId];
      if (def) {
        EventBus.emit(Events.SHOW_NOTIFICATION, { message: `Used ${def.name}. Health restored!` });
      } else {
        EventBus.emit(Events.SHOW_NOTIFICATION, { message: 'Used item.' });
      }
    } else {
      EventBus.emit(Events.SHOW_NOTIFICATION, { message: 'Health is already full!' });
    }

    this.refreshDisplay();
    const newItems = this.inventory.getItems();
    if (this.selectedIndex >= newItems.length) {
      this.selectedIndex = Math.max(0, newItems.length - 1);
    }
    this.selectItem(this.selectedIndex);
  }

  private refreshDisplay(): void {
    const items = this.inventory.getItems();

    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      if (i < items.length) {
        const slot = items[i];
        const def = ITEMS[slot.itemId];
        if (!def) {
          continue;
        }
        const color = TYPE_COLORS[def.type] ?? 0x888888;
        this.itemCells[i].setFillStyle(color, 0.6);
        this.itemCells[i].setStrokeStyle(1, color);
        this.itemTexts[i].setText(def.name);
        this.qtyTexts[i].setText(slot.quantity > 1 ? `${slot.quantity}` : '');
      } else {
        this.itemCells[i].setFillStyle(0x2a2a4e, 0.8);
        this.itemCells[i].setStrokeStyle(1, 0x445566);
        this.itemTexts[i].setText('');
        this.qtyTexts[i].setText('');
      }
    }

    const equipped = this.inventory.getEquippedSlots();
    for (const slot of ['weapon', 'lantern', 'accessory']) {
      const itemId = equipped[slot];
      if (itemId) {
        const def = ITEMS[itemId];
        if (!def) {
          this.equippedTexts[slot].setText('(invalid item)');
          this.equippedTexts[slot].setColor('#666666');
          continue;
        }
        let label = def.name;
        if (def.stats?.damage) label += ` (dmg: ${def.stats.damage})`;
        if (def.stats?.defense) label += ` (def: ${def.stats.defense})`;
        this.equippedTexts[slot].setText(label);
        this.equippedTexts[slot].setColor('#ffffff');
      } else {
        this.equippedTexts[slot].setText('(empty)');
        this.equippedTexts[slot].setColor('#666666');
      }
    }
  }
}
