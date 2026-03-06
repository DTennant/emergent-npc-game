import Phaser from 'phaser';
import { Inventory } from '../inventory/Inventory';
import { ITEMS } from '../inventory/types';
import { TradeSystem, TradeItem } from '../crafting/TradeSystem';
import { NPCShop } from '../crafting/TradeData';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface TradeSceneData {
  inventory: Inventory;
  shop: NPCShop;
  trust: number;
}

type TradeMode = 'buy' | 'sell';

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 520;
const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 9;

export class TradeScene extends Phaser.Scene {
  private inventory!: Inventory;
  private shop!: NPCShop;
  private trust = 0;
  private tradeSystem!: TradeSystem;
  private mode: TradeMode = 'buy';
  private selectedIndex = 0;
  private scrollOffset = 0;
  private items: TradeItem[] = [];
  private listContainer!: Phaser.GameObjects.Container;
  private goldText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private modeButtons: { buy: Phaser.GameObjects.Text; sell: Phaser.GameObjects.Text } = {
    buy: null!,
    sell: null!,
  };

  constructor() {
    super({ key: 'TradeScene' });
  }

  init(data: TradeSceneData): void {
    this.inventory = data.inventory;
    this.shop = data.shop;
    this.trust = data.trust;
    this.mode = 'buy';
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }

  create(): void {
    this.tradeSystem = new TradeSystem();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(50).setInteractive();

    this.add.rectangle(cx, cy, PANEL_WIDTH, PANEL_HEIGHT, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4488ff).setDepth(51);

    this.add.text(cx, cy - PANEL_HEIGHT / 2 + 20, this.shop.shopName, {
      fontSize: '20px',
      color: '#4488ff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(52);

    const tabY = cy - PANEL_HEIGHT / 2 + 52;

    this.modeButtons.buy = this.add.text(cx - 60, tabY, '  Buy  ', {
      fontSize: '14px',
      color: '#000000',
      backgroundColor: '#4488ff',
      padding: { x: 12, y: 4 },
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(53).setInteractive();

    this.modeButtons.sell = this.add.text(cx + 60, tabY, '  Sell  ', {
      fontSize: '14px',
      color: '#cccccc',
      backgroundColor: '#333344',
      padding: { x: 12, y: 4 },
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(53).setInteractive();

    this.modeButtons.buy.on('pointerdown', () => this.switchMode('buy'));
    this.modeButtons.sell.on('pointerdown', () => this.switchMode('sell'));

    this.goldText = this.add.text(cx + PANEL_WIDTH / 2 - 20, tabY, '', {
      fontSize: '14px',
      color: '#ffd700',
      resolution: window.devicePixelRatio,
    }).setOrigin(1, 0.5).setDepth(52);

    this.listContainer = this.add.container(0, 0).setDepth(53);

    this.statusText = this.add.text(cx, cy + PANEL_HEIGHT / 2 - 50, '', {
      fontSize: '13px',
      color: '#44ff88',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(54);

    this.add.text(cx, cy + PANEL_HEIGHT / 2 - 16, 'ESC close  |  TAB switch  |  ↑↓ select  |  ENTER trade', {
      fontSize: '11px',
      color: '#888888',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(52);

    this.refreshItems();
    this.renderList();
    this.updateGold();

    this.input.keyboard!.on('keydown-ESC', () => this.scene.stop());
    this.input.keyboard!.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.switchMode(this.mode === 'buy' ? 'sell' : 'buy');
    });
    this.input.keyboard!.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.handleTrade());

    EventBus.on(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
  }

  shutdown(): void {
    EventBus.off(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
  }

  private onInventoryChange(): void {
    this.refreshItems();
    this.renderList();
    this.updateGold();
  }

  private switchMode(mode: TradeMode): void {
    this.mode = mode;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.statusText.setText('');

    if (mode === 'buy') {
      this.modeButtons.buy.setBackgroundColor('#4488ff');
      this.modeButtons.buy.setColor('#000000');
      this.modeButtons.sell.setBackgroundColor('#333344');
      this.modeButtons.sell.setColor('#cccccc');
    } else {
      this.modeButtons.sell.setBackgroundColor('#4488ff');
      this.modeButtons.sell.setColor('#000000');
      this.modeButtons.buy.setBackgroundColor('#333344');
      this.modeButtons.buy.setColor('#cccccc');
    }

    this.refreshItems();
    this.renderList();
  }

  private refreshItems(): void {
    if (this.mode === 'buy') {
      this.items = this.tradeSystem.getBuyList(this.shop, this.trust);
    } else {
      this.items = this.tradeSystem.getSellList(this.shop, this.inventory, this.trust);
    }
    if (this.selectedIndex >= this.items.length) {
      this.selectedIndex = Math.max(0, this.items.length - 1);
    }
  }

  private navigate(dir: number): void {
    this.selectedIndex = Phaser.Math.Clamp(
      this.selectedIndex + dir,
      0,
      Math.max(0, this.items.length - 1)
    );

    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + VISIBLE_ROWS) {
      this.scrollOffset = this.selectedIndex - VISIBLE_ROWS + 1;
    }

    this.renderList();
    this.statusText.setText('');
  }

  private updateGold(): void {
    const gold = this.inventory.getItemCount('gold');
    this.goldText.setText(`Gold: ${gold}`);
  }

  private renderList(): void {
    this.listContainer.removeAll(true);

    const listX = GAME_WIDTH / 2 - PANEL_WIDTH / 2 + 20;
    const listY = GAME_HEIGHT / 2 - PANEL_HEIGHT / 2 + 75;
    const listWidth = PANEL_WIDTH - 40;

    if (this.items.length === 0) {
      const emptyMsg = this.mode === 'buy'
        ? 'Nothing for sale right now.'
        : 'You have nothing to sell here.';
      const empty = this.add.text(listX + listWidth / 2, listY + 80, emptyMsg, {
        fontSize: '13px',
        color: '#888888',
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5);
      this.listContainer.add(empty);
      return;
    }

    const headerY = listY - 4;
    const hName = this.add.text(listX + 8, headerY, 'Item', {
      fontSize: '11px', color: '#888888', resolution: window.devicePixelRatio,
    });
    const hPrice = this.add.text(listX + listWidth - 80, headerY, 'Price', {
      fontSize: '11px', color: '#888888', resolution: window.devicePixelRatio,
    });
    const hStock = this.add.text(listX + listWidth - 8, headerY, this.mode === 'buy' ? 'Stock' : 'Qty', {
      fontSize: '11px', color: '#888888', resolution: window.devicePixelRatio,
    }).setOrigin(1, 0);
    this.listContainer.add([hName, hPrice, hStock]);

    const endIdx = Math.min(this.scrollOffset + VISIBLE_ROWS, this.items.length);
    for (let i = this.scrollOffset; i < endIdx; i++) {
      const item = this.items[i];
      const rowY = listY + 16 + (i - this.scrollOffset) * ROW_HEIGHT;
      const selected = i === this.selectedIndex;
      const gold = this.inventory.getItemCount('gold');
      const canAfford = this.mode === 'buy' ? gold >= item.price : true;
      const dimmed = item.locked || (this.mode === 'buy' && !canAfford);

      if (selected) {
        const hl = this.add.rectangle(
          listX + listWidth / 2, rowY + ROW_HEIGHT / 2 - 4,
          listWidth, ROW_HEIGHT - 4, 0x4488ff, 0.15
        ).setStrokeStyle(1, 0x4488ff);
        this.listContainer.add(hl);
      }

      let nameColor = selected ? '#4488ff' : '#ffffff';
      if (dimmed) nameColor = '#555555';

      const name = this.add.text(listX + 8, rowY + 2, item.def.name, {
        fontSize: '13px',
        color: nameColor,
        fontStyle: selected ? 'bold' : 'normal',
        resolution: window.devicePixelRatio,
      });
      this.listContainer.add(name);

      if (item.locked && item.lockReason) {
        const lockLabel = this.add.text(listX + 8, rowY + 18, `🔒 ${item.lockReason}`, {
          fontSize: '9px', color: '#ff6666', resolution: window.devicePixelRatio,
        });
        this.listContainer.add(lockLabel);
      } else {
        const typeLabel = item.def.stats?.damage
          ? `dmg: ${item.def.stats.damage}`
          : item.def.stats?.defense
          ? `def: ${item.def.stats.defense}`
          : item.def.type;
        const typeText = this.add.text(listX + 8, rowY + 18, typeLabel, {
          fontSize: '9px', color: '#777777', resolution: window.devicePixelRatio,
        });
        this.listContainer.add(typeText);
      }

      const priceColor = dimmed ? '#555555' : '#ffd700';
      const priceText = this.add.text(listX + listWidth - 80, rowY + 6, `${item.price}g`, {
        fontSize: '13px', color: priceColor, resolution: window.devicePixelRatio,
      });
      this.listContainer.add(priceText);

      const stockText = this.add.text(listX + listWidth - 8, rowY + 6, `${item.stock}`, {
        fontSize: '13px', color: dimmed ? '#555555' : '#aaaaaa', resolution: window.devicePixelRatio,
      }).setOrigin(1, 0);
      this.listContainer.add(stockText);
    }

    if (this.items.length > VISIBLE_ROWS) {
      const scrollInfo = this.add.text(
        listX + listWidth - 8,
        listY + 16 + VISIBLE_ROWS * ROW_HEIGHT + 4,
        `${this.selectedIndex + 1}/${this.items.length}`,
        { fontSize: '10px', color: '#666666', resolution: window.devicePixelRatio }
      ).setOrigin(1, 0);
      this.listContainer.add(scrollInfo);
    }
  }

  private handleTrade(): void {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.items.length) return;

    const item = this.items[this.selectedIndex];
    if (item.locked) {
      this.statusText.setText('This item is locked. Build more trust.');
      this.statusText.setColor('#ff6666');
      return;
    }

    let success: boolean;
    if (this.mode === 'buy') {
      success = this.tradeSystem.buyItem(this.shop, item.itemId, 1, this.inventory, this.trust);
      if (success) {
        this.statusText.setText(`Bought: ${item.def.name}`);
        this.statusText.setColor('#44ff88');
      } else {
        this.statusText.setText('Not enough gold!');
        this.statusText.setColor('#ff6666');
      }
    } else {
      success = this.tradeSystem.sellItem(this.shop, item.itemId, 1, this.inventory, this.trust);
      if (success) {
        this.statusText.setText(`Sold: ${item.def.name} for ${item.price}g`);
        this.statusText.setColor('#44ff88');
      } else {
        this.statusText.setText('Cannot sell this item.');
        this.statusText.setColor('#ff6666');
      }
    }
  }
}
