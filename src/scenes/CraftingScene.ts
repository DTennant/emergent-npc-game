import Phaser from 'phaser';
import { Inventory } from '../inventory/Inventory';
import { ITEMS } from '../inventory/types';
import { CraftingSystem } from '../crafting/CraftingSystem';
import { CraftingRecipe } from '../crafting/CraftingRecipes';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface CraftingSceneData {
  inventory: Inventory;
  npcTrustMap: Record<string, number>;
  atBench: boolean;
}

const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 500;
const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 8;

export class CraftingScene extends Phaser.Scene {
  private inventory!: Inventory;
  private npcTrustMap!: Record<string, number>;
  private atBench = false;
  private craftingSystem!: CraftingSystem;
  private recipes: CraftingRecipe[] = [];
  private selectedIndex = 0;
  private scrollOffset = 0;
  private recipeContainer!: Phaser.GameObjects.Container;
  private detailContainer!: Phaser.GameObjects.Container;
  private craftButton!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CraftingScene' });
  }

  init(data: CraftingSceneData): void {
    this.inventory = data.inventory;
    this.npcTrustMap = data.npcTrustMap;
    this.atBench = data.atBench;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }

  create(): void {
    this.craftingSystem = new CraftingSystem();
    this.recipes = this.craftingSystem.getAvailableRecipes(
      this.inventory,
      this.npcTrustMap,
      this.atBench
    );

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(50).setInteractive();

    this.add.rectangle(cx, cy, PANEL_WIDTH, PANEL_HEIGHT, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xffd700).setDepth(51);

    const benchLabel = this.atBench ? 'Crafting Bench' : 'Crafting (Field)';
    this.add.text(cx, cy - PANEL_HEIGHT / 2 + 20, benchLabel, {
      fontSize: '20px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(52);

    this.recipeContainer = this.add.container(0, 0).setDepth(53);
    this.detailContainer = this.add.container(0, 0).setDepth(53);

    this.craftButton = this.add.text(cx + 80, cy + PANEL_HEIGHT / 2 - 50, '  Craft  ', {
      fontSize: '16px',
      color: '#000000',
      backgroundColor: '#44cc44',
      padding: { x: 16, y: 8 },
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(54).setInteractive();

    this.craftButton.on('pointerdown', () => this.handleCraft());
    this.craftButton.on('pointerover', () => this.craftButton.setAlpha(0.8));
    this.craftButton.on('pointerout', () => this.craftButton.setAlpha(1));

    this.resultText = this.add.text(cx - 80, cy + PANEL_HEIGHT / 2 - 50, '', {
      fontSize: '13px',
      color: '#44ff88',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(54);

    this.add.text(cx, cy + PANEL_HEIGHT / 2 - 16, 'ESC / C to close  |  ↑↓ select  |  ENTER craft', {
      fontSize: '11px',
      color: '#888888',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(52);

    this.renderRecipeList();
    this.renderDetail();

    this.input.keyboard!.on('keydown-ESC', () => this.scene.stop());
    this.input.keyboard!.on('keydown-C', () => this.scene.stop());
    this.input.keyboard!.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard!.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard!.on('keydown-ENTER', () => this.handleCraft());

    EventBus.on(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
  }

  shutdown(): void {
    EventBus.off(Events.INVENTORY_CHANGE, this.onInventoryChange, this);
  }

  private onInventoryChange(): void {
    this.recipes = this.craftingSystem.getAvailableRecipes(
      this.inventory,
      this.npcTrustMap,
      this.atBench
    );
    if (this.selectedIndex >= this.recipes.length) {
      this.selectedIndex = Math.max(0, this.recipes.length - 1);
    }
    this.renderRecipeList();
    this.renderDetail();
  }

  private navigate(dir: number): void {
    this.selectedIndex = Phaser.Math.Clamp(
      this.selectedIndex + dir,
      0,
      Math.max(0, this.recipes.length - 1)
    );

    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + VISIBLE_ROWS) {
      this.scrollOffset = this.selectedIndex - VISIBLE_ROWS + 1;
    }

    this.renderRecipeList();
    this.renderDetail();
    this.resultText.setText('');
  }

  private renderRecipeList(): void {
    this.recipeContainer.removeAll(true);

    const listX = GAME_WIDTH / 2 - PANEL_WIDTH / 2 + 20;
    const listY = GAME_HEIGHT / 2 - PANEL_HEIGHT / 2 + 55;
    const listWidth = PANEL_WIDTH - 40;

    if (this.recipes.length === 0) {
      const empty = this.add.text(listX + listWidth / 2, listY + 60, 'No recipes available.\nFind a crafting bench or build NPC trust.', {
        fontSize: '13px',
        color: '#888888',
        align: 'center',
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5);
      this.recipeContainer.add(empty);
      return;
    }

    const endIdx = Math.min(this.scrollOffset + VISIBLE_ROWS, this.recipes.length);
    for (let i = this.scrollOffset; i < endIdx; i++) {
      const recipe = this.recipes[i];
      const rowY = listY + (i - this.scrollOffset) * ROW_HEIGHT;
      const canCraft = this.craftingSystem.canCraft(recipe, this.inventory);
      const selected = i === this.selectedIndex;

      if (selected) {
        const highlight = this.add.rectangle(
          listX + listWidth / 2, rowY + ROW_HEIGHT / 2 - 4,
          listWidth, ROW_HEIGHT - 4, 0xffd700, 0.15
        ).setStrokeStyle(1, 0xffd700);
        this.recipeContainer.add(highlight);
      }

      const nameColor = selected ? '#ffd700' : (canCraft ? '#ffffff' : '#666666');
      const name = this.add.text(listX + 8, rowY + 4, recipe.name, {
        fontSize: '14px',
        color: nameColor,
        fontStyle: selected ? 'bold' : 'normal',
        resolution: window.devicePixelRatio,
      });
      this.recipeContainer.add(name);

      const resultDef = ITEMS[recipe.result.itemId];
      const qtyStr = recipe.result.quantity > 1 ? ` x${recipe.result.quantity}` : '';
      const resultLabel = this.add.text(listX + listWidth - 8, rowY + 4, `→ ${resultDef?.name ?? recipe.result.itemId}${qtyStr}`, {
        fontSize: '12px',
        color: canCraft ? '#44ff88' : '#555555',
        resolution: window.devicePixelRatio,
      }).setOrigin(1, 0);
      this.recipeContainer.add(resultLabel);

      const ingStr = recipe.ingredients
        .map((ing) => {
          const d = ITEMS[ing.itemId];
          const have = this.inventory.getItemCount(ing.itemId);
          const color = have >= ing.quantity ? '#aaffaa' : '#ff6666';
          return `${d?.name ?? ing.itemId} ${have}/${ing.quantity}`;
        })
        .join('  ');

      const ingText = this.add.text(listX + 8, rowY + 22, ingStr, {
        fontSize: '10px',
        color: '#999999',
        resolution: window.devicePixelRatio,
      });
      this.recipeContainer.add(ingText);
    }

    if (this.recipes.length > VISIBLE_ROWS) {
      const scrollInfo = this.add.text(
        listX + listWidth - 8,
        listY + VISIBLE_ROWS * ROW_HEIGHT + 2,
        `${this.selectedIndex + 1}/${this.recipes.length}`,
        { fontSize: '10px', color: '#666666', resolution: window.devicePixelRatio }
      ).setOrigin(1, 0);
      this.recipeContainer.add(scrollInfo);
    }
  }

  private renderDetail(): void {
    this.detailContainer.removeAll(true);

    if (this.selectedIndex < 0 || this.selectedIndex >= this.recipes.length) {
      this.craftButton.setVisible(false);
      return;
    }

    const recipe = this.recipes[this.selectedIndex];
    const canCraft = this.craftingSystem.canCraft(recipe, this.inventory);

    const detailY = GAME_HEIGHT / 2 + PANEL_HEIGHT / 2 - 100;
    const detailX = GAME_WIDTH / 2 - PANEL_WIDTH / 2 + 20;

    const desc = this.add.text(detailX + 8, detailY, recipe.description, {
      fontSize: '12px',
      color: '#cccccc',
      wordWrap: { width: PANEL_WIDTH - 60 },
      resolution: window.devicePixelRatio,
    });
    this.detailContainer.add(desc);

    this.craftButton.setVisible(true);
    if (canCraft) {
      this.craftButton.setBackgroundColor('#44cc44');
      this.craftButton.setText('  Craft  ');
    } else {
      this.craftButton.setBackgroundColor('#444444');
      this.craftButton.setText(' Missing ');
    }
  }

  private handleCraft(): void {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.recipes.length) return;

    const recipe = this.recipes[this.selectedIndex];
    const success = this.craftingSystem.craft(recipe, this.inventory);

    if (success) {
      const resultDef = ITEMS[recipe.result.itemId];
      this.resultText.setText(`Crafted: ${resultDef?.name ?? recipe.result.itemId}!`);
      this.resultText.setColor('#44ff88');
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `Crafted: ${resultDef?.name ?? recipe.result.itemId}`,
      });
    } else {
      this.resultText.setText('Missing materials.');
      this.resultText.setColor('#ff6666');
    }
  }
}
