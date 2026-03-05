import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TILE_SIZE, NPC_COLORS } from '../config';
import { TextureKeys } from '../assets/keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createProgressBar();

    // Load Kenney roguelike spritesheet (16×16 tiles, 1px spacing)
    this.load.spritesheet('kenney_roguelike', 'assets/kenney/roguelikeSheet_transparent.png', {
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 1,
    });

    // Load Kenney UI atlas (Starling XML format)
    this.load.atlasXML('kenney_ui', 'assets/kenney/uipack_rpg_sheet.png', 'assets/kenney/uipack_rpg_sheet.xml');
  }

  create(): void {
    // Generate procedural textures as fallback
    this.generateTextures();

    // Upgrade to Kenney sprite textures if loaded successfully
    this.upgradeTextures();

    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
      this.scene.launch('SettingsScene', {
        onClose: () => {
          this.scene.start('WorldScene');
        }
      });
    } else {
      this.scene.start('WorldScene');
    }
  }

  private createProgressBar(): void {
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;

    const text = this.add.text(width / 2, height / 2 - 30, 'Loading Thornwick...', {
      fontSize: '20px',
      color: '#ffffff',
      resolution: window.devicePixelRatio,
    });
    text.setOrigin(0.5);

    const progressBar = this.add.rectangle(
      width / 2, height / 2 + 10,
      300, 20,
      0x333333
    );
    progressBar.setStrokeStyle(1, 0x666666);

    const progressFill = this.add.rectangle(
      width / 2 - 148, height / 2 + 10,
      0, 16,
      0x44aa44
    );
    progressFill.setOrigin(0, 0.5);

    this.load.on('progress', (value: number) => {
      progressFill.width = 296 * value;
    });
  }

  private generateTextures(): void {
    // --- Tile Textures ---

    // Grass tile
    const grassGfx = this.add.graphics();
    grassGfx.fillStyle(COLORS.grass);
    grassGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    grassGfx.fillStyle(0x2d6b37);
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      grassGfx.fillRect(x, y, 2, 4);
    }
    grassGfx.generateTexture(TextureKeys.TILE_GRASS, TILE_SIZE, TILE_SIZE);
    grassGfx.destroy();

    // Path tile
    const pathGfx = this.add.graphics();
    pathGfx.fillStyle(COLORS.path);
    pathGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    pathGfx.fillStyle(0xb89448);
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      pathGfx.fillRect(x, y, 3, 3);
    }
    pathGfx.generateTexture(TextureKeys.TILE_PATH, TILE_SIZE, TILE_SIZE);
    pathGfx.destroy();

    // --- Player Texture ---

    const playerW = Math.floor(TILE_SIZE * 0.8);
    const playerH = Math.floor(TILE_SIZE * 0.8);
    const playerGfx = this.add.graphics();
    playerGfx.fillStyle(COLORS.player);
    playerGfx.fillRect(0, 0, playerW, playerH);
    playerGfx.lineStyle(2, 0xffffff);
    playerGfx.strokeRect(1, 1, playerW - 2, playerH - 2);
    playerGfx.generateTexture(TextureKeys.PLAYER, playerW, playerH);
    playerGfx.destroy();

    // --- NPC Textures ---

    const npcW = Math.floor(TILE_SIZE * 0.8);
    const npcH = Math.floor(TILE_SIZE * 0.8);
    const npcEntries: [string, number][] = [
      [TextureKeys.NPC_BLACKSMITH, NPC_COLORS.blacksmith_erik],
      [TextureKeys.NPC_INNKEEPER, NPC_COLORS.innkeeper_rose],
      [TextureKeys.NPC_MERCHANT, NPC_COLORS.merchant_anna],
      [TextureKeys.NPC_FARMER, NPC_COLORS.farmer_thomas],
      [TextureKeys.NPC_GUARD, NPC_COLORS.guard_marcus],
      [TextureKeys.NPC_HERBALIST, NPC_COLORS.herbalist_willow],
    ];

    for (const [key, color] of npcEntries) {
      const gfx = this.add.graphics();
      gfx.fillStyle(color);
      gfx.fillRect(0, 0, npcW, npcH);
      gfx.lineStyle(2, 0xffffff, 0.5);
      gfx.strokeRect(1, 1, npcW - 2, npcH - 2);
      gfx.generateTexture(key, npcW, npcH);
      gfx.destroy();
    }

    // --- Building Textures ---

    const buildingDefs: [string, number, number, number][] = [
      [TextureKeys.BUILDING_FORGE, COLORS.forge, 80, 60],
      [TextureKeys.BUILDING_INN, COLORS.inn, 90, 70],
      [TextureKeys.BUILDING_MARKET, COLORS.market, 70, 50],
      [TextureKeys.BUILDING_FARM, COLORS.farm, 100, 60],
      [TextureKeys.BUILDING_GUARD, COLORS.guardPost, 60, 50],
      [TextureKeys.BUILDING_HERBS, COLORS.herbShop, 70, 50],
    ];

    for (const [key, color, w, h] of buildingDefs) {
      const gfx = this.add.graphics();
      gfx.fillStyle(color, 0.7);
      gfx.fillRect(0, 0, w, h);
      gfx.lineStyle(2, 0x000000, 0.5);
      gfx.strokeRect(1, 1, w - 2, h - 2);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    }

    // --- Effect / Item / Enemy Textures ---

    const enemyGfx = this.add.graphics();
    enemyGfx.fillStyle(0x555555);
    enemyGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    enemyGfx.generateTexture(TextureKeys.ENEMY_WOLF, TILE_SIZE, TILE_SIZE);
    enemyGfx.destroy();

    const swordGfx = this.add.graphics();
    swordGfx.fillStyle(0xcccccc);
    swordGfx.fillRect(0, 0, 16, 16);
    swordGfx.generateTexture(TextureKeys.ITEM_SWORD, 16, 16);
    swordGfx.destroy();

    const blightGfx = this.add.graphics();
    blightGfx.fillStyle(0x440066, 0.6);
    blightGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    blightGfx.generateTexture(TextureKeys.EFFECT_BLIGHT, TILE_SIZE, TILE_SIZE);
    blightGfx.destroy();

    // --- Boss Textures ---

    const bossWolfSize = Math.floor(TILE_SIZE * 1.5);
    const bossWolfGfx = this.add.graphics();
    bossWolfGfx.fillStyle(0x333333);
    bossWolfGfx.fillRect(0, 0, bossWolfSize, bossWolfSize);
    bossWolfGfx.fillStyle(0xff0000);
    bossWolfGfx.fillCircle(bossWolfSize * 0.3, bossWolfSize * 0.3, 3);
    bossWolfGfx.fillCircle(bossWolfSize * 0.7, bossWolfSize * 0.3, 3);
    bossWolfGfx.lineStyle(2, 0x880000);
    bossWolfGfx.strokeRect(1, 1, bossWolfSize - 2, bossWolfSize - 2);
    bossWolfGfx.generateTexture(TextureKeys.BOSS_SHADOW_WOLF, bossWolfSize, bossWolfSize);
    bossWolfGfx.destroy();

    const bossGolemSize = Math.floor(TILE_SIZE * 2);
    const bossGolemGfx = this.add.graphics();
    bossGolemGfx.fillStyle(0x6699cc);
    bossGolemGfx.fillRect(0, 0, bossGolemSize, bossGolemSize);
    bossGolemGfx.fillStyle(0x88bbee);
    bossGolemGfx.fillRect(4, 4, bossGolemSize - 8, bossGolemSize - 8);
    bossGolemGfx.lineStyle(2, 0xaaddff);
    bossGolemGfx.strokeRect(1, 1, bossGolemSize - 2, bossGolemSize - 2);
    bossGolemGfx.generateTexture(TextureKeys.BOSS_CRYSTAL_GOLEM, bossGolemSize, bossGolemSize);
    bossGolemGfx.destroy();

    const bossWraithSize = Math.floor(TILE_SIZE * 1.5);
    const bossWraithGfx = this.add.graphics();
    bossWraithGfx.fillStyle(0x8800aa, 0.7);
    bossWraithGfx.fillRect(0, 0, bossWraithSize, bossWraithSize);
    bossWraithGfx.fillStyle(0xcc44ff, 0.5);
    bossWraithGfx.fillRect(4, 4, bossWraithSize - 8, bossWraithSize - 8);
    bossWraithGfx.lineStyle(2, 0xaa22dd);
    bossWraithGfx.strokeRect(1, 1, bossWraithSize - 2, bossWraithSize - 2);
    bossWraithGfx.generateTexture(TextureKeys.BOSS_BLIGHT_WRAITH, bossWraithSize, bossWraithSize);
    bossWraithGfx.destroy();
  }

  private upgradeTextures(): void {
    const sheet = this.textures.get('kenney_roguelike');
    if (!sheet || sheet.key === '__MISSING') return;

    console.log('Kenney frames:', sheet.frameTotal);

    const COLS = 57;

    // Frame index helper: row * columns + col
    const f = (row: number, col: number) => row * COLS + col;

    // Tiles
    this.upgradeTexture(TextureKeys.TILE_GRASS, f(0, 0), TILE_SIZE, TILE_SIZE);
    this.upgradeTexture(TextureKeys.TILE_PATH, f(0, 6), TILE_SIZE, TILE_SIZE);

    // Player (knight character — row 28, col 0)
    const playerW = Math.floor(TILE_SIZE * 0.8);
    const playerH = Math.floor(TILE_SIZE * 0.8);
    this.upgradeTexture(TextureKeys.PLAYER, f(28, 0), playerW, playerH);

    // NPCs (various humanoid sprites rows 26-30)
    const npcW = Math.floor(TILE_SIZE * 0.8);
    const npcH = Math.floor(TILE_SIZE * 0.8);
    this.upgradeTexture(TextureKeys.NPC_BLACKSMITH, f(28, 1), npcW, npcH);
    this.upgradeTexture(TextureKeys.NPC_INNKEEPER, f(28, 4), npcW, npcH);
    this.upgradeTexture(TextureKeys.NPC_MERCHANT, f(28, 6), npcW, npcH);
    this.upgradeTexture(TextureKeys.NPC_FARMER, f(28, 2), npcW, npcH);
    this.upgradeTexture(TextureKeys.NPC_GUARD, f(28, 3), npcW, npcH);
    this.upgradeTexture(TextureKeys.NPC_HERBALIST, f(28, 5), npcW, npcH);

    // Enemy wolf (animal area — row 23)
    this.upgradeTexture(TextureKeys.ENEMY_WOLF, f(23, 0), TILE_SIZE, TILE_SIZE);

    // Item sword (items area — row 17)
    this.upgradeTexture(TextureKeys.ITEM_SWORD, f(17, 0), 16, 16);

    // Blight effect (dark/purple tile — row 3, col 6)
    this.upgradeTexture(TextureKeys.EFFECT_BLIGHT, f(3, 6), TILE_SIZE, TILE_SIZE);

    // Buildings (wall/structure tiles — rows 5-10)
    this.upgradeTexture(TextureKeys.BUILDING_FORGE, f(6, 0), 80, 60);
    this.upgradeTexture(TextureKeys.BUILDING_INN, f(6, 2), 90, 70);
    this.upgradeTexture(TextureKeys.BUILDING_MARKET, f(6, 4), 70, 50);
    this.upgradeTexture(TextureKeys.BUILDING_FARM, f(7, 0), 100, 60);
    this.upgradeTexture(TextureKeys.BUILDING_GUARD, f(7, 2), 60, 50);
    this.upgradeTexture(TextureKeys.BUILDING_HERBS, f(7, 4), 70, 50);

    // Boss textures
    const bossWolfSize = Math.floor(TILE_SIZE * 1.5);
    this.upgradeTexture(TextureKeys.BOSS_SHADOW_WOLF, f(23, 1), bossWolfSize, bossWolfSize);

    const bossGolemSize = Math.floor(TILE_SIZE * 2);
    this.upgradeTexture(TextureKeys.BOSS_CRYSTAL_GOLEM, f(24, 0), bossGolemSize, bossGolemSize);

    const bossWraithSz = Math.floor(TILE_SIZE * 1.5);
    this.upgradeTexture(TextureKeys.BOSS_BLIGHT_WRAITH, f(24, 2), bossWraithSz, bossWraithSz);
  }

  private upgradeTexture(key: string, frameIndex: number, width: number, height: number): void {
    const sheet = this.textures.get('kenney_roguelike');
    if (!sheet || sheet.key === '__MISSING') return;

    const frame = sheet.get(frameIndex);
    if (!frame || frame.name === '__BASE') return;

    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }

    const canvasTexture = this.textures.createCanvas(key, width, height);
    if (!canvasTexture) return;
    const ctx = canvasTexture.getContext();

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      frame.source.image as HTMLImageElement,
      frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      0, 0, width, height
    );

    canvasTexture.refresh();
  }
}
