import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, TILE_SIZE, NPC_COLORS } from '../config';
import { TextureKeys } from '../assets/keys';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createProgressBar();

    // Load Kenney roguelike spritesheet (16x16 tiles, 1px spacing)
    this.load.spritesheet('kenney_roguelike', 'assets/kenney/roguelikeSheet_transparent.png', {
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 1,
    });

    // Load Kenney UI atlas (Starling XML format)
    this.load.atlasXML('kenney_ui', 'assets/kenney/uipack_rpg_sheet.png', 'assets/kenney/uipack_rpg_sheet.xml');

    // Load AI-Town folk spritesheet source (we'll slice it up in create)
    this.load.image('folk_sheet', 'assets/32x32folk.png');

    // Load campfire spritesheet
    this.load.spritesheet('campfire', 'assets/spritesheets/campfire.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create(): void {
    this.generateTextures();
    this.upgradeToSpritesheetCharacters();

    // Disabled: Kenney spritesheet frame indices need remapping
    // this.upgradeTextures();

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
    this.generateGrassTile();
    this.generatePathTile();

    // --- Character Textures ---
    this.generatePlayerTexture();
    this.generateNPCTextures();

    // --- Building Textures ---
    this.generateBuildingTextures();

    // --- Enemy / Item / Effect Textures ---
    this.generateEnemyTextures();
    this.generateItemTextures();
    this.generateEffectTextures();

    // --- Boss Textures ---
    this.generateBossTextures();

    // Set NEAREST filter on sprite textures for crisp pixel art
    const spriteKeys = Object.values(TextureKeys);
    for (const key of spriteKeys) {
      const tex = this.textures.get(key);
      if (tex && tex.key !== '__MISSING') {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  private upgradeToSpritesheetCharacters(): void {
    if (!this.textures.exists('folk_sheet')) return;

    const source = this.textures.get('folk_sheet').getSourceImage() as HTMLImageElement;
    
    // Character definitions: [atlasPrefix, textureKey, startX, startY]
    // 32x32folk.png mapping based on grid
    const characters: [string, string, number, number][] = [
      ['player', TextureKeys.PLAYER, 0, 0],
      ['anna', TextureKeys.NPC_MERCHANT, 192, 0],
      ['erik', TextureKeys.NPC_BLACKSMITH, 288, 0],
      ['willow', TextureKeys.NPC_HERBALIST, 0, 128],
      ['rose', TextureKeys.NPC_INNKEEPER, 96, 128],
      ['thomas', TextureKeys.NPC_FARMER, 192, 128],
      ['marcus', TextureKeys.NPC_GUARD, 288, 128],
    ];
    
    for (const [prefix, textureKey, baseX, baseY] of characters) {
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(source, baseX, baseY, 96, 128, 0, 0, 96, 128);

      if (this.textures.exists(textureKey)) {
        this.textures.remove(this.textures.get(textureKey));
      }

      const canvasTex = this.textures.createCanvas(textureKey, 96, 128);
      if (!canvasTex) continue;
      const destCtx = canvasTex.getContext();
      destCtx.drawImage(canvas, 0, 0);
      canvasTex.refresh();

      const texture = this.textures.get(textureKey);
      let frameIdx = 0;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          texture.add(frameIdx, 0, col * 32, row * 32, 32, 32);
          frameIdx++;
        }
      }
      
      const tex = this.textures.get(textureKey);
      if (tex) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      
      this.anims.create({
        key: `${textureKey}_walk_down`,
        frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1,
        yoyo: true,
      });

      this.anims.create({
        key: `${textureKey}_walk_left`,
        frames: this.anims.generateFrameNumbers(textureKey, { start: 3, end: 5 }),
        frameRate: 8,
        repeat: -1,
        yoyo: true,
      });

      this.anims.create({
        key: `${textureKey}_walk_right`,
        frames: this.anims.generateFrameNumbers(textureKey, { start: 6, end: 8 }),
        frameRate: 8,
        repeat: -1,
        yoyo: true,
      });

      this.anims.create({
        key: `${textureKey}_walk_up`,
        frames: this.anims.generateFrameNumbers(textureKey, { start: 9, end: 11 }),
        frameRate: 8,
        repeat: -1,
        yoyo: true,
      });
    }
    
    if (this.textures.exists('campfire')) {
      const campTex = this.textures.get('campfire');
      campTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      
      this.anims.create({
        key: 'campfire_burn',
        frames: this.anims.generateFrameNumbers('campfire', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  // --- Tile generation ---

  private generateGrassTile(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(COLORS.grass);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Grass blade details
    const shades = [0x2d6b37, 0x4a8c54, 0x357a3f];
    for (let i = 0; i < 8; i++) {
      gfx.fillStyle(shades[i % shades.length]);
      const x = Math.random() * (TILE_SIZE - 2);
      const y = Math.random() * (TILE_SIZE - 4);
      gfx.fillRect(x, y, 1, 3 + Math.random() * 3);
    }
    // Small flower accents
    gfx.fillStyle(0xccdd55, 0.6);
    gfx.fillRect(6, 12, 2, 2);
    gfx.fillRect(22, 5, 2, 2);
    gfx.generateTexture(TextureKeys.TILE_GRASS, TILE_SIZE, TILE_SIZE);
    gfx.destroy();
  }

  private generatePathTile(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(COLORS.path);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Pebble details
    gfx.fillStyle(0xb89448);
    for (let i = 0; i < 6; i++) {
      const x = 2 + Math.random() * (TILE_SIZE - 6);
      const y = 2 + Math.random() * (TILE_SIZE - 6);
      gfx.fillCircle(x, y, 1 + Math.random() * 1.5);
    }
    // Worn track marks
    gfx.fillStyle(0xa88838, 0.5);
    gfx.fillRect(4, 8, TILE_SIZE - 8, 2);
    gfx.fillRect(4, 22, TILE_SIZE - 8, 2);
    gfx.generateTexture(TextureKeys.TILE_PATH, TILE_SIZE, TILE_SIZE);
    gfx.destroy();
  }

  // --- Character generation ---

  private generatePlayerTexture(): void {
    const w = Math.floor(TILE_SIZE * 0.8);
    const h = Math.floor(TILE_SIZE * 0.8);
    const gfx = this.add.graphics();
    const cx = w / 2;

    // Body (blue tunic)
    gfx.fillStyle(0x3366aa);
    gfx.fillRect(cx - 6, 8, 12, 12);

    // Head (skin)
    gfx.fillStyle(0xeebb88);
    gfx.fillCircle(cx, 6, 5);

    // Hair (dark brown)
    gfx.fillStyle(0x553311);
    gfx.fillRect(cx - 5, 1, 10, 4);

    // Arms
    gfx.fillStyle(0x3366aa);
    gfx.fillRect(cx - 9, 9, 4, 8);
    gfx.fillRect(cx + 5, 9, 4, 8);

    // Legs
    gfx.fillStyle(0x554433);
    gfx.fillRect(cx - 4, 20, 3, 5);
    gfx.fillRect(cx + 1, 20, 3, 5);

    // Sword (right hand)
    gfx.fillStyle(0xcccccc);
    gfx.fillRect(cx + 8, 4, 2, 12);
    gfx.fillStyle(0xaa8833);
    gfx.fillRect(cx + 6, 14, 6, 2);

    // Belt
    gfx.fillStyle(0x886633);
    gfx.fillRect(cx - 6, 16, 12, 2);

    gfx.generateTexture(TextureKeys.PLAYER, w, h);
    gfx.destroy();
  }

  private generateNPCTextures(): void {
    const w = Math.floor(TILE_SIZE * 0.8);
    const h = Math.floor(TILE_SIZE * 0.8);

    // Erik the Blacksmith - muscular, dark apron, hammer
    this.generateCharacterTexture(TextureKeys.NPC_BLACKSMITH, w, h, {
      bodyColor: NPC_COLORS.blacksmith_erik,
      hairColor: 0x332211,
      skinColor: 0xcc9966,
      apron: true,
      apronColor: 0x333333,
      accessory: 'hammer',
    });

    // Rose the Innkeeper - warm colors, apron, friendly
    this.generateCharacterTexture(TextureKeys.NPC_INNKEEPER, w, h, {
      bodyColor: NPC_COLORS.innkeeper_rose,
      hairColor: 0x993322,
      skinColor: 0xeebb99,
      apron: true,
      apronColor: 0xffffff,
      accessory: 'mug',
    });

    // Anna the Merchant - purple robe, coin pouch
    this.generateCharacterTexture(TextureKeys.NPC_MERCHANT, w, h, {
      bodyColor: NPC_COLORS.merchant_anna,
      hairColor: 0x221133,
      skinColor: 0xddaa88,
      apron: false,
      apronColor: 0,
      accessory: 'pouch',
    });

    // Thomas the Farmer - green, straw hat, pitchfork
    this.generateCharacterTexture(TextureKeys.NPC_FARMER, w, h, {
      bodyColor: NPC_COLORS.farmer_thomas,
      hairColor: 0xcc9944,
      skinColor: 0xccaa77,
      apron: false,
      apronColor: 0,
      accessory: 'hat',
    });

    // Marcus the Guard - armor, shield, stern
    this.generateCharacterTexture(TextureKeys.NPC_GUARD, w, h, {
      bodyColor: NPC_COLORS.guard_marcus,
      hairColor: 0x222222,
      skinColor: 0xddbb99,
      apron: false,
      apronColor: 0,
      accessory: 'shield',
    });

    // Willow the Herbalist - green dress, flower
    this.generateCharacterTexture(TextureKeys.NPC_HERBALIST, w, h, {
      bodyColor: NPC_COLORS.herbalist_willow,
      hairColor: 0x66aa44,
      skinColor: 0xeeccaa,
      apron: false,
      apronColor: 0,
      accessory: 'flower',
    });
  }

  private generateCharacterTexture(
    key: string,
    w: number,
    h: number,
    opts: {
      bodyColor: number;
      hairColor: number;
      skinColor: number;
      apron: boolean;
      apronColor: number;
      accessory: string;
    }
  ): void {
    const gfx = this.add.graphics();
    const cx = w / 2;

    // Body
    gfx.fillStyle(opts.bodyColor);
    gfx.fillRect(cx - 6, 8, 12, 12);

    // Head
    gfx.fillStyle(opts.skinColor);
    gfx.fillCircle(cx, 6, 5);

    // Hair
    gfx.fillStyle(opts.hairColor);
    gfx.fillRect(cx - 5, 1, 10, 4);

    // Arms
    gfx.fillStyle(opts.bodyColor);
    gfx.fillRect(cx - 9, 9, 4, 8);
    gfx.fillRect(cx + 5, 9, 4, 8);

    // Legs
    gfx.fillStyle(0x554433);
    gfx.fillRect(cx - 4, 20, 3, 5);
    gfx.fillRect(cx + 1, 20, 3, 5);

    // Apron
    if (opts.apron) {
      gfx.fillStyle(opts.apronColor, 0.8);
      gfx.fillRect(cx - 5, 12, 10, 8);
    }

    // Accessories
    switch (opts.accessory) {
      case 'hammer':
        gfx.fillStyle(0x888888);
        gfx.fillRect(cx + 7, 5, 3, 10);
        gfx.fillStyle(0xaaaaaa);
        gfx.fillRect(cx + 5, 3, 7, 4);
        break;
      case 'mug':
        gfx.fillStyle(0xaa8844);
        gfx.fillRect(cx + 7, 10, 4, 5);
        gfx.fillStyle(0xeedd99, 0.8);
        gfx.fillRect(cx + 8, 11, 2, 3);
        break;
      case 'pouch':
        gfx.fillStyle(0xccaa33);
        gfx.fillCircle(cx + 8, 16, 3);
        gfx.fillStyle(0xffdd44);
        gfx.fillCircle(cx + 8, 16, 1.5);
        break;
      case 'hat':
        gfx.fillStyle(0xccbb66);
        gfx.fillRect(cx - 7, 0, 14, 3);
        gfx.fillRect(cx - 4, -2, 8, 3);
        break;
      case 'shield':
        gfx.fillStyle(0x777799);
        gfx.fillRect(cx - 10, 9, 4, 10);
        gfx.fillStyle(0x8888aa);
        gfx.fillRect(cx - 9, 11, 2, 6);
        // Helmet visor
        gfx.fillStyle(0x777799);
        gfx.fillRect(cx - 5, 1, 10, 5);
        gfx.fillStyle(0x222222);
        gfx.fillRect(cx - 3, 4, 6, 2);
        break;
      case 'flower':
        gfx.fillStyle(0x44aa44);
        gfx.fillRect(cx + 7, 8, 2, 8);
        gfx.fillStyle(0xff66aa);
        gfx.fillCircle(cx + 8, 7, 3);
        gfx.fillStyle(0xffaacc);
        gfx.fillCircle(cx + 8, 7, 1.5);
        break;
    }

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  // --- Building generation ---

  private generateBuildingTextures(): void {
    this.generateBuilding(TextureKeys.BUILDING_FORGE, COLORS.forge, 80, 60, 'forge');
    this.generateBuilding(TextureKeys.BUILDING_INN, COLORS.inn, 90, 70, 'inn');
    this.generateBuilding(TextureKeys.BUILDING_MARKET, COLORS.market, 70, 50, 'market');
    this.generateBuilding(TextureKeys.BUILDING_FARM, COLORS.farm, 100, 60, 'farm');
    this.generateBuilding(TextureKeys.BUILDING_GUARD, COLORS.guardPost, 60, 50, 'guard');
    this.generateBuilding(TextureKeys.BUILDING_HERBS, COLORS.herbShop, 70, 50, 'herbs');
  }

  private generateBuilding(
    key: string,
    color: number,
    w: number,
    h: number,
    type: string
  ): void {
    const gfx = this.add.graphics();

    // Roof (triangular top, darker shade)
    const roofH = Math.floor(h * 0.35);
    gfx.fillStyle(this.darkenColor(color, 0.6));
    gfx.fillTriangle(w / 2, 0, 0, roofH, w, roofH);

    // Walls
    gfx.fillStyle(color, 0.85);
    gfx.fillRect(2, roofH, w - 4, h - roofH - 2);

    // Wall border
    gfx.lineStyle(2, this.darkenColor(color, 0.4));
    gfx.strokeRect(2, roofH, w - 4, h - roofH - 2);

    // Door
    const doorW = Math.floor(w * 0.15);
    const doorH = Math.floor(h * 0.3);
    gfx.fillStyle(0x553322);
    gfx.fillRect(w / 2 - doorW / 2, h - doorH - 2, doorW, doorH);
    // Door handle
    gfx.fillStyle(0xccaa44);
    gfx.fillCircle(w / 2 + doorW / 4, h - doorH / 2 - 2, 1.5);

    // Windows
    const winSize = Math.floor(Math.min(w, h) * 0.12);
    gfx.fillStyle(0x88ccff, 0.8);
    gfx.fillRect(w * 0.2, roofH + 6, winSize, winSize);
    gfx.fillRect(w * 0.7, roofH + 6, winSize, winSize);
    // Window cross
    gfx.lineStyle(1, 0x553322);
    gfx.strokeRect(w * 0.2, roofH + 6, winSize, winSize);
    gfx.strokeRect(w * 0.7, roofH + 6, winSize, winSize);

    // Type-specific details
    switch (type) {
      case 'forge':
        // Chimney with smoke
        gfx.fillStyle(0x444444);
        gfx.fillRect(w * 0.75, 0, 8, roofH);
        gfx.fillStyle(0x888888, 0.5);
        gfx.fillCircle(w * 0.75 + 4, -3, 4);
        gfx.fillCircle(w * 0.75 + 6, -7, 3);
        break;
      case 'inn':
        // Sign hanging from roof
        gfx.fillStyle(0x886633);
        gfx.fillRect(6, roofH - 2, 16, 10);
        gfx.fillStyle(0xffcc00);
        gfx.fillCircle(14, roofH + 3, 3);
        break;
      case 'market':
        // Awning
        gfx.fillStyle(0xcc3333, 0.7);
        gfx.fillRect(0, roofH - 2, w, 5);
        gfx.fillStyle(0xffffff, 0.7);
        gfx.fillRect(0, roofH - 2, w / 3, 5);
        gfx.fillRect(w * 2 / 3, roofH - 2, w / 3, 5);
        break;
      case 'farm':
        // Hay bale beside building
        gfx.fillStyle(0xccaa44);
        gfx.fillCircle(w - 8, h - 8, 6);
        gfx.fillStyle(0xbb9933);
        gfx.fillCircle(w - 8, h - 8, 3);
        break;
      case 'guard':
        // Flag on top
        gfx.fillStyle(0x553322);
        gfx.fillRect(w / 2 - 1, -4, 2, roofH + 4);
        gfx.fillStyle(0xcc2222);
        gfx.fillRect(w / 2 + 1, -4, 10, 6);
        break;
      case 'herbs':
        // Flower boxes under windows
        gfx.fillStyle(0x885533);
        gfx.fillRect(w * 0.15, roofH + 6 + winSize, winSize + 6, 4);
        gfx.fillStyle(0x44cc44);
        gfx.fillCircle(w * 0.2 + 2, roofH + 6 + winSize, 3);
        gfx.fillStyle(0xff88aa);
        gfx.fillCircle(w * 0.2 + winSize - 2, roofH + 6 + winSize, 2);
        break;
    }

    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  // --- Enemy textures ---

  private generateEnemyTextures(): void {
    const s = TILE_SIZE;
    const gfx = this.add.graphics();

    // Wolf body (top-down view)
    gfx.fillStyle(0x555555);
    // Body oval
    gfx.fillRect(s * 0.2, s * 0.25, s * 0.6, s * 0.45);
    // Head
    gfx.fillStyle(0x666666);
    gfx.fillCircle(s * 0.5, s * 0.2, s * 0.18);
    // Snout
    gfx.fillStyle(0x777777);
    gfx.fillRect(s * 0.4, s * 0.05, s * 0.2, s * 0.1);
    // Eyes (red - corrupted)
    gfx.fillStyle(0xff2222);
    gfx.fillCircle(s * 0.38, s * 0.17, 2);
    gfx.fillCircle(s * 0.62, s * 0.17, 2);
    // Ears
    gfx.fillStyle(0x555555);
    gfx.fillTriangle(s * 0.3, s * 0.12, s * 0.22, s * 0.02, s * 0.38, s * 0.08);
    gfx.fillTriangle(s * 0.7, s * 0.12, s * 0.78, s * 0.02, s * 0.62, s * 0.08);
    // Tail
    gfx.fillStyle(0x555555);
    gfx.fillRect(s * 0.4, s * 0.68, s * 0.08, s * 0.2);
    // Legs
    gfx.fillStyle(0x444444);
    gfx.fillRect(s * 0.2, s * 0.6, s * 0.12, s * 0.15);
    gfx.fillRect(s * 0.68, s * 0.6, s * 0.12, s * 0.15);
    gfx.fillRect(s * 0.2, s * 0.28, s * 0.1, s * 0.12);
    gfx.fillRect(s * 0.7, s * 0.28, s * 0.1, s * 0.12);

    gfx.generateTexture(TextureKeys.ENEMY_WOLF, s, s);
    gfx.destroy();
  }

  private generateItemTextures(): void {
    const gfx = this.add.graphics();

    // Sword
    // Blade
    gfx.fillStyle(0xccccdd);
    gfx.fillRect(7, 1, 2, 10);
    // Blade shine
    gfx.fillStyle(0xeeeeff);
    gfx.fillRect(8, 2, 1, 8);
    // Guard
    gfx.fillStyle(0xaa8833);
    gfx.fillRect(4, 10, 8, 2);
    // Grip
    gfx.fillStyle(0x664422);
    gfx.fillRect(6, 12, 4, 3);
    // Pommel
    gfx.fillStyle(0xaa8833);
    gfx.fillCircle(8, 15, 1.5);

    gfx.generateTexture(TextureKeys.ITEM_SWORD, 16, 16);
    gfx.destroy();
  }

  private generateEffectTextures(): void {
    const s = TILE_SIZE;
    const gfx = this.add.graphics();

    // Blight effect - dark corruption with swirling tendrils
    gfx.fillStyle(0x220033, 0.4);
    gfx.fillRect(0, 0, s, s);
    // Dark patches
    gfx.fillStyle(0x330044, 0.5);
    gfx.fillCircle(s * 0.3, s * 0.3, 6);
    gfx.fillCircle(s * 0.7, s * 0.6, 8);
    gfx.fillCircle(s * 0.5, s * 0.8, 5);
    // Purple tendrils
    gfx.fillStyle(0x7700aa, 0.4);
    gfx.fillRect(2, s * 0.4, s * 0.6, 2);
    gfx.fillRect(s * 0.3, 4, 2, s * 0.5);
    gfx.fillRect(s * 0.5, s * 0.3, s * 0.4, 2);
    // Glowing particles
    gfx.fillStyle(0xcc44ff, 0.6);
    gfx.fillCircle(s * 0.2, s * 0.5, 1.5);
    gfx.fillCircle(s * 0.8, s * 0.3, 1);
    gfx.fillCircle(s * 0.5, s * 0.9, 1.5);

    gfx.generateTexture(TextureKeys.EFFECT_BLIGHT, s, s);
    gfx.destroy();
  }

  // --- Boss textures ---

  private generateBossTextures(): void {
    this.generateShadowWolf();
    this.generateCrystalGolem();
    this.generateBlightWraith();
  }

  private generateShadowWolf(): void {
    const s = Math.floor(TILE_SIZE * 1.5);
    const gfx = this.add.graphics();

    // Larger, darker wolf with shadow aura
    // Shadow aura
    gfx.fillStyle(0x220022, 0.3);
    gfx.fillCircle(s / 2, s / 2, s * 0.45);

    // Body
    gfx.fillStyle(0x222222);
    gfx.fillRect(s * 0.15, s * 0.25, s * 0.7, s * 0.4);

    // Head
    gfx.fillStyle(0x1a1a1a);
    gfx.fillCircle(s * 0.5, s * 0.2, s * 0.2);

    // Snout
    gfx.fillStyle(0x333333);
    gfx.fillRect(s * 0.38, s * 0.05, s * 0.24, s * 0.1);

    // Glowing red eyes
    gfx.fillStyle(0xff0000);
    gfx.fillCircle(s * 0.38, s * 0.18, 3);
    gfx.fillCircle(s * 0.62, s * 0.18, 3);
    // Eye glow
    gfx.fillStyle(0xff4444, 0.5);
    gfx.fillCircle(s * 0.38, s * 0.18, 5);
    gfx.fillCircle(s * 0.62, s * 0.18, 5);

    // Ears
    gfx.fillStyle(0x222222);
    gfx.fillTriangle(s * 0.3, s * 0.12, s * 0.2, 0, s * 0.4, s * 0.06);
    gfx.fillTriangle(s * 0.7, s * 0.12, s * 0.8, 0, s * 0.6, s * 0.06);

    // Legs
    gfx.fillStyle(0x1a1a1a);
    gfx.fillRect(s * 0.15, s * 0.58, s * 0.15, s * 0.2);
    gfx.fillRect(s * 0.7, s * 0.58, s * 0.15, s * 0.2);
    gfx.fillRect(s * 0.15, s * 0.28, s * 0.12, s * 0.15);
    gfx.fillRect(s * 0.73, s * 0.28, s * 0.12, s * 0.15);

    // Tail
    gfx.fillStyle(0x222222);
    gfx.fillRect(s * 0.38, s * 0.62, s * 0.1, s * 0.25);

    // Shadow wisps
    gfx.fillStyle(0x440044, 0.4);
    gfx.fillCircle(s * 0.2, s * 0.7, 4);
    gfx.fillCircle(s * 0.8, s * 0.4, 3);
    gfx.fillCircle(s * 0.3, s * 0.85, 3);

    gfx.generateTexture(TextureKeys.BOSS_SHADOW_WOLF, s, s);
    gfx.destroy();
  }

  private generateCrystalGolem(): void {
    const s = Math.floor(TILE_SIZE * 2);
    const gfx = this.add.graphics();

    // Large crystal body
    gfx.fillStyle(0x4477aa);
    gfx.fillRect(s * 0.2, s * 0.15, s * 0.6, s * 0.65);

    // Crystal facets (angular shapes)
    gfx.fillStyle(0x6699cc);
    gfx.fillTriangle(s * 0.5, s * 0.05, s * 0.3, s * 0.2, s * 0.7, s * 0.2);
    gfx.fillStyle(0x88bbee);
    gfx.fillTriangle(s * 0.5, s * 0.05, s * 0.4, s * 0.2, s * 0.6, s * 0.2);

    // Shoulders
    gfx.fillStyle(0x5588bb);
    gfx.fillRect(s * 0.1, s * 0.2, s * 0.2, s * 0.2);
    gfx.fillRect(s * 0.7, s * 0.2, s * 0.2, s * 0.2);

    // Arms
    gfx.fillStyle(0x4477aa);
    gfx.fillRect(s * 0.08, s * 0.35, s * 0.15, s * 0.35);
    gfx.fillRect(s * 0.77, s * 0.35, s * 0.15, s * 0.35);

    // Legs
    gfx.fillStyle(0x3366aa);
    gfx.fillRect(s * 0.25, s * 0.75, s * 0.18, s * 0.2);
    gfx.fillRect(s * 0.57, s * 0.75, s * 0.18, s * 0.2);

    // Eyes (glowing)
    gfx.fillStyle(0x44eeff);
    gfx.fillCircle(s * 0.38, s * 0.25, 4);
    gfx.fillCircle(s * 0.62, s * 0.25, 4);
    gfx.fillStyle(0xaaffff, 0.5);
    gfx.fillCircle(s * 0.38, s * 0.25, 6);
    gfx.fillCircle(s * 0.62, s * 0.25, 6);

    // Crystal highlights
    gfx.fillStyle(0xaaddff, 0.6);
    gfx.fillRect(s * 0.35, s * 0.3, 3, 8);
    gfx.fillRect(s * 0.55, s * 0.4, 3, 6);
    gfx.fillRect(s * 0.45, s * 0.55, 2, 10);

    // Border/outline
    gfx.lineStyle(2, 0x3355aa);
    gfx.strokeRect(s * 0.2, s * 0.15, s * 0.6, s * 0.65);

    gfx.generateTexture(TextureKeys.BOSS_CRYSTAL_GOLEM, s, s);
    gfx.destroy();
  }

  private generateBlightWraith(): void {
    const s = Math.floor(TILE_SIZE * 1.5);
    const gfx = this.add.graphics();

    // Ghostly aura
    gfx.fillStyle(0x550088, 0.2);
    gfx.fillCircle(s / 2, s / 2, s * 0.45);

    // Wraith body (tattered robes)
    gfx.fillStyle(0x6600aa, 0.7);
    gfx.fillTriangle(s * 0.5, s * 0.1, s * 0.15, s * 0.85, s * 0.85, s * 0.85);

    // Inner robe (lighter)
    gfx.fillStyle(0x8822cc, 0.5);
    gfx.fillTriangle(s * 0.5, s * 0.2, s * 0.25, s * 0.8, s * 0.75, s * 0.8);

    // Hood
    gfx.fillStyle(0x440066);
    gfx.fillCircle(s * 0.5, s * 0.2, s * 0.18);

    // Face void (dark)
    gfx.fillStyle(0x110022);
    gfx.fillCircle(s * 0.5, s * 0.22, s * 0.1);

    // Glowing eyes
    gfx.fillStyle(0xff44ff);
    gfx.fillCircle(s * 0.42, s * 0.2, 2.5);
    gfx.fillCircle(s * 0.58, s * 0.2, 2.5);
    gfx.fillStyle(0xff88ff, 0.5);
    gfx.fillCircle(s * 0.42, s * 0.2, 4);
    gfx.fillCircle(s * 0.58, s * 0.2, 4);

    // Spectral hands
    gfx.fillStyle(0x8844cc, 0.6);
    gfx.fillRect(s * 0.08, s * 0.35, s * 0.15, s * 0.1);
    gfx.fillRect(s * 0.77, s * 0.35, s * 0.15, s * 0.1);

    // Tattered hem wisps
    gfx.fillStyle(0x7700aa, 0.4);
    gfx.fillRect(s * 0.2, s * 0.82, 4, 8);
    gfx.fillRect(s * 0.4, s * 0.85, 3, 7);
    gfx.fillRect(s * 0.6, s * 0.82, 4, 8);
    gfx.fillRect(s * 0.75, s * 0.84, 3, 6);

    // Blight particles
    gfx.fillStyle(0xcc44ff, 0.5);
    gfx.fillCircle(s * 0.15, s * 0.5, 2);
    gfx.fillCircle(s * 0.85, s * 0.6, 1.5);
    gfx.fillCircle(s * 0.3, s * 0.9, 2);
    gfx.fillCircle(s * 0.7, s * 0.9, 1.5);

    gfx.generateTexture(TextureKeys.BOSS_BLIGHT_WRAITH, s, s);
    gfx.destroy();
  }

  // --- Utility ---

  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  // --- Kenney spritesheet upgrade (disabled) ---

  private upgradeTextures(): void {
    // Disabled: Kenney spritesheet frame indices need remapping.
    // The roguelikeSheet_transparent.png has 57x31 tiles but the
    // character/item positions differ from what was originally mapped.
    // Keep this infrastructure for future use once correct indices are determined.
    return;

    const sheet = this.textures.get('kenney_roguelike');
    if (!sheet || sheet.key === '__MISSING') return;

    console.log('Kenney frames:', sheet.frameTotal);

    const COLS = 57;

    // Frame index helper: row * columns + col
    const f = (row: number, col: number) => row * COLS + col;

    // Tiles
    this.upgradeTexture(TextureKeys.TILE_GRASS, f(0, 0), TILE_SIZE, TILE_SIZE);
    this.upgradeTexture(TextureKeys.TILE_PATH, f(0, 6), TILE_SIZE, TILE_SIZE);

    // Player (knight character - row 28, col 0)
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

    // Enemy wolf (animal area - row 23)
    this.upgradeTexture(TextureKeys.ENEMY_WOLF, f(23, 0), TILE_SIZE, TILE_SIZE);

    // Item sword (items area - row 17)
    this.upgradeTexture(TextureKeys.ITEM_SWORD, f(17, 0), 16, 16);

    // Blight effect (dark/purple tile - row 3, col 6)
    this.upgradeTexture(TextureKeys.EFFECT_BLIGHT, f(3, 6), TILE_SIZE, TILE_SIZE);

    // Buildings (wall/structure tiles - rows 5-10)
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
