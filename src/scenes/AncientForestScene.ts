import Phaser from 'phaser';
import { GameState } from '../world/GameState';
import { BlightSystem } from '../world/BlightSystem';
import { EventBus, Events } from '../world/EventBus';
import { TextureKeys } from '../assets/keys';
import { CombatSystem } from '../combat/CombatSystem';
import { HealthBar } from '../combat/HealthBar';
import { Enemy, WOLF_CONFIG } from '../combat/Enemy';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  PLAYER_SPEED,
  INTERACTION_DISTANCE,
  PLAYER_MAX_HEALTH,
  fs,
} from '../config';

interface ItemPickupDef {
  itemId: string;
  quantity?: number;
  x: number;
  y: number;
  label: string;
}

interface ItemPickupInstance {
  def: ItemPickupDef;
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface AncientForestInitData {
  spawnX?: number;
  spawnY?: number;
}

interface ClearingDef {
  title: string;
  enemies: Array<{ x: number; y: number; strong?: boolean }>;
  items: ItemPickupDef[];
  exits: Array<{ direction: 'north' | 'south' | 'east' | 'west'; target: number | 'world' }>;
}

const CLEARING_DEFS: ClearingDef[] = [
  // Clearing 0: Forest Entrance
  {
    title: '\uD83C\uDF32 Ancient Forest \u2014 Entrance',
    enemies: [
      { x: 400, y: 300 },
      { x: 800, y: 600 },
    ],
    items: [],
    exits: [
      { direction: 'south', target: 'world' },
      { direction: 'north', target: 1 },
      { direction: 'east', target: 2 },
    ],
  },
  // Clearing 1: Moonpetal Glade
  {
    title: '\uD83C\uDF38 Moonpetal Glade',
    enemies: [
      { x: 600, y: 400 },
    ],
    items: [
      { itemId: 'moonpetal', x: 300, y: 350, label: 'Moonpetal' },
      { itemId: 'moonpetal', x: 550, y: 600, label: 'Moonpetal' },
      { itemId: 'moonpetal', x: 900, y: 300, label: 'Moonpetal' },
      { itemId: 'enchantment_dust', x: 700, y: 700, label: 'Enchantment Dust' },
    ],
    exits: [
      { direction: 'south', target: 0 },
      { direction: 'east', target: 3 },
    ],
  },
  // Clearing 2: Ruined Shrine
  {
    title: '\uD83C\uDFDA\uFE0F Ruined Shrine',
    enemies: [
      { x: 350, y: 250 },
      { x: 700, y: 500 },
      { x: 900, y: 350 },
    ],
    items: [
      { itemId: 'aldric_journal_3', x: 640, y: 400, label: "Aldric's Journal (Part 3)" },
    ],
    exits: [
      { direction: 'west', target: 0 },
      { direction: 'north', target: 3 },
    ],
  },
  // Clearing 3: Blight Origin
  {
    title: '\u2620\uFE0F Blight Origin',
    enemies: [
      { x: 300, y: 300, strong: true },
      { x: 700, y: 250, strong: true },
      { x: 500, y: 600, strong: true },
      { x: 900, y: 500, strong: true },
    ],
    items: [],
    exits: [
      { direction: 'south', target: 2 },
      { direction: 'west', target: 1 },
    ],
  },
];

export class AncientForestScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    I: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private combatSystem!: CombatSystem;
  private playerHealthBar!: HealthBar;
  private playerFacing = 'down';
  private enemies: Enemy[] = [];
  private blightSystem!: BlightSystem;
  private itemPickups: ItemPickupInstance[] = [];
  private interactionPrompt!: Phaser.GameObjects.Text;
  private transitioning = false;
  private inInventory = false;
  private spawnX = GAME_WIDTH / 2;
  private spawnY = GAME_HEIGHT - 60;
  private blightParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private currentClearing = 0;
  private clearingObjects: Phaser.GameObjects.GameObject[] = [];
  private titleText: Phaser.GameObjects.Text | null = null;
  private darkOverlay: Phaser.GameObjects.Rectangle | null = null;
  private vortexGraphics: Phaser.GameObjects.Arc | null = null;

  constructor() {
    super({ key: 'AncientForestScene' });
  }

  init(data?: AncientForestInitData): void {
    this.spawnX = data?.spawnX ?? GAME_WIDTH / 2;
    this.spawnY = data?.spawnY ?? GAME_HEIGHT - 60;
    this.transitioning = false;
    this.inInventory = false;
    this.enemies = [];
    this.itemPickups = [];
    this.currentClearing = 0;
    this.blightParticles = null;
    this.clearingObjects = [];
    this.titleText = null;
    this.darkOverlay = null;
    this.vortexGraphics = null;
  }

  create(): void {
    const gs = GameState.get(this);
    gs.currentZone = 'ancient_forest';

    this.createForestGround();

    this.blightSystem = new BlightSystem(this);

    // Blight ambient particles
    if (this.textures.exists('particle_circle')) {
      this.blightParticles = this.add.particles(0, 0, 'particle_circle', {
        emitting: false,
        lifespan: { min: 2000, max: 4000 },
        frequency: 150,
        quantity: 1,
        speed: { min: 10, max: 30 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.5, end: 1.4 },
        alpha: { start: 0.7, end: 0 },
        tint: [0x8800ff, 0x6600cc, 0x440088],
        blendMode: Phaser.BlendModes.ADD,
        emitZone: {
          type: 'random',
          source: new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
        } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      });
      this.blightParticles.setDepth(20);
    }

    this.player = this.physics.add.sprite(this.spawnX, this.spawnY, TextureKeys.PLAYER);
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);

    this.playerLabel = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE * 0.7,
      'You',
      {
        fontSize: fs(24),
        color: '#88bbff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      }
    );
    this.playerLabel.setOrigin(0.5, 1);
    this.playerLabel.setDepth(11);

    this.combatSystem = new CombatSystem(this, this.player);
    this.playerHealthBar = new HealthBar(
      this,
      this.player.x,
      this.player.y - TILE_SIZE,
      TILE_SIZE,
      4,
      PLAYER_MAX_HEALTH
    );

    EventBus.on(Events.PLAYER_DIED, this.onPlayerDied, this);
    EventBus.on(Events.ENTITY_DIED, this.onEntityDied, this);
    EventBus.on(Events.ITEM_ACQUIRED, this.onItemAcquired, this);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      I: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I),
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.interactionPrompt = this.add.text(0, 0, '', {
      fontSize: fs(26),
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
      resolution: window.devicePixelRatio,
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setDepth(20);
    this.interactionPrompt.setVisible(false);

    this.scene.launch('HUDScene', { worldState: gs.worldState, llmClient: gs.llmClient });

    this.wasd.E.on('down', () => {
      if (this.transitioning) return;
      this.tryPickupItem();
    });

    this.wasd.I.on('down', () => {
      if (this.transitioning) return;
      if (this.inInventory) {
        this.scene.stop('InventoryScene');
        this.inInventory = false;
      } else {
        this.inInventory = true;
        this.scene.launch('InventoryScene', { inventory: gs.inventory, combatSystem: this.combatSystem });
        this.scene.get('InventoryScene').events.once('shutdown', () => {
          this.inInventory = false;
        });
      }
    });

    this.input.keyboard!.addKey('J').on('down', () => {
      if (this.transitioning) return;
      if (this.scene.isActive('QuestJournalScene')) {
        this.scene.stop('QuestJournalScene');
      } else {
        this.scene.launch('QuestJournalScene');
      }
    });

    this.spaceKey.on('down', () => {
      if (this.transitioning) return;
      this.handlePlayerAttack();
    });

    this.loadClearing();

    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(400);
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;

    const gs = GameState.get(this);
    gs.worldState.update(delta);

    if (this.blightParticles) {
      const intensity = Math.max(0.4, this.blightSystem?.getIntensity() ?? 0);
      const clearingMult = this.currentClearing === 3 ? 2.0 : 1.0;
      this.blightParticles.emitting = true;
      this.blightParticles.frequency = Math.max(20, 300 - intensity * 300 * clearingMult);
      this.blightParticles.quantity = Math.ceil(intensity * 5 * clearingMult);
    }

    this.handlePlayerMovement();

    for (const enemy of this.enemies) {
      if (!enemy.isDead()) {
        enemy.update(delta, this.player.x, this.player.y);
      }
    }

    this.checkEnemyAttacks();
    this.checkProximityPrompts();
    this.checkClearingExit();

    this.playerLabel.setPosition(this.player.x, this.player.y - TILE_SIZE * 0.7);
    this.playerHealthBar.setPosition(this.player.x, this.player.y - TILE_SIZE);
    this.playerHealthBar.setHealth(this.combatSystem.getHealth());
  }

  shutdown(): void {
    this.cleanupEvents();
  }

  private cleanupEvents(): void {
    EventBus.off(Events.PLAYER_DIED, this.onPlayerDied, this);
    EventBus.off(Events.ENTITY_DIED, this.onEntityDied, this);
    EventBus.off(Events.ITEM_ACQUIRED, this.onItemAcquired, this);
  }

  private onPlayerDied(): void {
    this.handlePlayerDeath();
  }

  private onEntityDied(data: { entity: string; drops: { itemId: string; quantity: number }[] }): void {
    const gs = GameState.get(this);
    for (const drop of data.drops) {
      gs.inventory.addItem(drop.itemId, drop.quantity);
    }
    EventBus.emit(Events.SHOW_NOTIFICATION, { message: `${data.entity} defeated!` });
  }

  private onItemAcquired(data: { itemId: string }): void {
    this.cameras.main.flash(200, 255, 255, 255, false);
    const gs = GameState.get(this);
    // Handle journal discovery
    if (data.itemId.startsWith('aldric_journal_') && !gs.storylineManager.blightAwareness) {
      gs.storylineManager.discoverBlight();
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: 'You sense the truth about the Blight...',
      });
    }
    const runestoneMap: Record<string, string> = {
      runestone_forest: 'forest_cave',
      runestone_mine: 'abandoned_mine',
      runestone_tower: 'ruined_tower',
    };
    const dungeonId = runestoneMap[data.itemId];
    if (dungeonId) {
      gs.storylineManager.obtainRunestone(dungeonId);
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `Runestone obtained! (${gs.storylineManager.getRunestoneCount()}/3)`,
      });
    }
  }

  // --- Forest Ground ---

  private createForestGround(): void {
    const newForestTiles = ['forest_ground1', 'forest_ground2', 'forest_ground3', 'forest_ground4',
                            'forest_dark1', 'forest_dark2', 'forest_dark3', 'forest_dark4'];
    const hasNewForest = newForestTiles.some((k) => this.textures.exists(k));

    const oldForestTiles = ['tile_forest', 'tile_forest2', 'tile_forest3', 'tile_forest4'];
    const hasOldForest = oldForestTiles.some((k) => this.textures.exists(k));

    for (let x = 0; x < GAME_WIDTH; x += TILE_SIZE) {
      for (let y = 0; y < GAME_HEIGHT; y += TILE_SIZE) {
        if (hasNewForest) {
          const availTiles = newForestTiles.filter((k) => this.textures.exists(k));
          const tileKey = availTiles[Math.floor(Math.random() * availTiles.length)];
          this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, tileKey).setDepth(0);
        } else if (hasOldForest) {
          const tileKey = oldForestTiles[Math.floor(Math.random() * oldForestTiles.length)];
          const tile = this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, tileKey);
          tile.setScale(2);
          tile.setDepth(0);
        } else {
          const shade = 0.6 + Math.random() * 0.3;
          const r = Math.floor(0x12 * shade);
          const g = Math.floor(0x30 * shade);
          const b = Math.floor(0x08 * shade);
          const color = (r << 16) | (g << 8) | b;
          this.add.rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, color).setDepth(0);
        }
      }
    }
  }

  // --- Clearing Management ---

  private loadClearing(): void {
    // Destroy old clearing objects
    for (const obj of this.clearingObjects) {
      if (obj && obj.active) {
        obj.destroy();
      }
    }
    this.clearingObjects = [];

    // Destroy old enemies
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    // Destroy old item pickups
    for (const pickup of this.itemPickups) {
      this.tweens.killTweensOf(pickup.sprite);
      if (pickup.sprite.active) pickup.sprite.destroy();
      if (pickup.label.active) pickup.label.destroy();
    }
    this.itemPickups = [];

    // Destroy old title
    if (this.titleText) {
      this.titleText.destroy();
      this.titleText = null;
    }

    // Destroy dark overlay
    if (this.darkOverlay) {
      this.darkOverlay.destroy();
      this.darkOverlay = null;
    }

    // Destroy vortex
    if (this.vortexGraphics) {
      this.tweens.killTweensOf(this.vortexGraphics);
      this.vortexGraphics.destroy();
      this.vortexGraphics = null;
    }

    const def = CLEARING_DEFS[this.currentClearing];

    // Title
    this.titleText = this.add.text(GAME_WIDTH / 2, 20, def.title, {
      fontSize: fs(34),
      color: this.currentClearing === 3 ? '#cc44ff' : '#88ff88',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    this.titleText.setOrigin(0.5);
    this.titleText.setDepth(15);

    // Scatter trees
    this.scatterClearingTrees();

    // Exit hints
    this.createExitHints(def);

    // Clearing-specific decorations
    if (this.currentClearing === 1) {
      this.createMoonpetalDecorations();
    } else if (this.currentClearing === 2) {
      this.createRuinedShrineDecorations();
    } else if (this.currentClearing === 3) {
      this.createBlightOriginDecorations();
    }

    // Spawn enemies
    this.spawnClearingEnemies(def);

    // Create item pickups
    this.createClearingItems(def);
  }

  private scatterClearingTrees(): void {
    const treePositions = [
      { x: 100, y: 100 }, { x: 300, y: 80 }, { x: 1100, y: 60 },
      { x: 150, y: 400 }, { x: 1050, y: 350 },
      { x: 200, y: 750 }, { x: 1000, y: 800 },
      { x: 50, y: 600 }, { x: 1200, y: 600 },
    ];

    const forestTreeKeys = ['forest_tree1', 'forest_tree2', 'forest_tree3', 'forest_tree4'];
    const hasForestTrees = forestTreeKeys.some((k) => this.textures.exists(k));

    for (const pos of treePositions) {
      if (hasForestTrees) {
        const available = forestTreeKeys.filter((k) => this.textures.exists(k));
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            const key = available[Math.floor(Math.random() * available.length)];
            const img = this.add.image(pos.x + dx * 32, pos.y + dy * 32, key).setDepth(2);
            this.clearingObjects.push(img);
          }
        }
      } else if (this.textures.exists('tile_tree')) {
        const tree = this.add.image(pos.x, pos.y, 'tile_tree');
        tree.setScale(3);
        tree.setDepth(2);
        tree.setAlpha(0.8);
        this.clearingObjects.push(tree);
      } else {
        const trunk = this.add.rectangle(pos.x, pos.y + 8, 8, 20, 0x3a2a1a);
        trunk.setDepth(2);
        this.clearingObjects.push(trunk);
        const canopy = this.add.circle(pos.x, pos.y - 8, 16, 0x1a4a1a, 0.9);
        canopy.setDepth(2);
        this.clearingObjects.push(canopy);
      }
    }
  }

  private createExitHints(def: ClearingDef): void {
    for (const exit of def.exits) {
      let x = 0;
      let y = 0;
      let text = '';
      let originX = 0.5;
      let originY = 0.5;

      switch (exit.direction) {
        case 'north':
          x = GAME_WIDTH / 2;
          y = 50;
          text = exit.target === 'world' ? '\u2191 Village' : '\u2191 North';
          originX = 0.5;
          originY = 0.5;
          break;
        case 'south':
          x = GAME_WIDTH / 2;
          y = GAME_HEIGHT - 50;
          text = exit.target === 'world' ? '\u2193 Village' : '\u2193 South';
          originX = 0.5;
          originY = 0.5;
          break;
        case 'east':
          x = GAME_WIDTH - 10;
          y = GAME_HEIGHT / 2;
          text = '\u2192 East';
          originX = 1;
          originY = 0.5;
          break;
        case 'west':
          x = 10;
          y = GAME_HEIGHT / 2;
          text = '\u2190 West';
          originX = 0;
          originY = 0.5;
          break;
      }

      const hint = this.add.text(x, y, text, {
        fontSize: fs(24),
        color: '#aaffaa',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      });
      hint.setOrigin(originX, originY);
      hint.setDepth(15);
      this.clearingObjects.push(hint);

      this.tweens.add({
        targets: hint,
        alpha: { from: 0.4, to: 1.0 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createMoonpetalDecorations(): void {
    // Flower decorations for Moonpetal Glade
    const flowerPositions = [
      { x: 200, y: 250 }, { x: 450, y: 500 }, { x: 750, y: 200 },
      { x: 350, y: 700 }, { x: 950, y: 550 }, { x: 600, y: 350 },
      { x: 150, y: 550 }, { x: 850, y: 650 }, { x: 1050, y: 250 },
    ];

    const flowerTiles = ['gentle_flower1', 'gentle_flower2', 'gentle_flower3'];
    const availableFlowers = flowerTiles.filter((k) => this.textures.exists(k));

    for (const pos of flowerPositions) {
      if (availableFlowers.length > 0) {
        const key = availableFlowers[Math.floor(Math.random() * availableFlowers.length)];
        const flower = this.add.image(pos.x, pos.y, key).setDepth(0.5);
        this.clearingObjects.push(flower);
      } else {
        // Fallback: small colored circles for flowers
        const colors = [0xff88cc, 0xffaadd, 0xcc66ff];
        const circle = this.add.circle(pos.x, pos.y, 6, colors[Math.floor(Math.random() * colors.length)], 0.7);
        circle.setDepth(0.5);
        this.clearingObjects.push(circle);
      }
    }
  }

  private createRuinedShrineDecorations(): void {
    // Ruined stone structures
    const stonePositions = [
      { x: 500, y: 300, w: 60, h: 40 },
      { x: 700, y: 350, w: 40, h: 50 },
      { x: 600, y: 500, w: 80, h: 30 },
      { x: 450, y: 450, w: 35, h: 45 },
      { x: 750, y: 250, w: 50, h: 35 },
    ];

    for (const stone of stonePositions) {
      const rect = this.add.rectangle(stone.x, stone.y, stone.w, stone.h, 0x555566, 0.7);
      rect.setDepth(1);
      rect.setStrokeStyle(1, 0x888899, 0.5);
      this.clearingObjects.push(rect);
    }

    // Broken pillar fragments
    const pillarPositions = [
      { x: 550, y: 280 }, { x: 680, y: 280 },
    ];
    for (const pos of pillarPositions) {
      const pillar = this.add.rectangle(pos.x, pos.y, 16, 50, 0x777788, 0.8);
      pillar.setDepth(2);
      this.clearingObjects.push(pillar);
      const top = this.add.rectangle(pos.x, pos.y - 30, 22, 8, 0x888899, 0.8);
      top.setDepth(2);
      this.clearingObjects.push(top);
    }
  }

  private createBlightOriginDecorations(): void {
    // Dark ground overlay for Clearing 3
    this.darkOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x0a000f, 0.4
    );
    this.darkOverlay.setDepth(0.1);

    // Dark vortex visual
    this.vortexGraphics = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 60, 0x1a0020, 0.6);
    this.vortexGraphics.setDepth(1);
    this.vortexGraphics.setStrokeStyle(3, 0x8800ff, 0.8);

    this.tweens.add({
      targets: this.vortexGraphics,
      scaleX: { from: 0.8, to: 1.3 },
      scaleY: { from: 0.8, to: 1.3 },
      alpha: { from: 0.4, to: 0.8 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Additional blight overlays at edges
    const edgeOverlays = [
      { x: 0, y: GAME_HEIGHT / 2, w: 100, h: GAME_HEIGHT },
      { x: GAME_WIDTH, y: GAME_HEIGHT / 2, w: 100, h: GAME_HEIGHT },
      { x: GAME_WIDTH / 2, y: 0, w: GAME_WIDTH, h: 80 },
      { x: GAME_WIDTH / 2, y: GAME_HEIGHT, w: GAME_WIDTH, h: 80 },
    ];
    for (const edge of edgeOverlays) {
      const overlay = this.add.rectangle(edge.x, edge.y, edge.w, edge.h, 0x1a0020, 0.3);
      overlay.setDepth(0.2);
      this.clearingObjects.push(overlay);
    }
  }

  private spawnClearingEnemies(def: ClearingDef): void {
    for (const enemyDef of def.enemies) {
      const config = enemyDef.strong
        ? { ...WOLF_CONFIG, name: 'Ancient Wolf', maxHealth: 45 }
        : WOLF_CONFIG;
      const wolf = new Enemy(this, enemyDef.x, enemyDef.y, TextureKeys.ENEMY_WOLF, config);
      wolf.sprite.setTint(0xaa44cc); // Purple tint for corrupted wolves
      if (enemyDef.strong) {
        wolf.setSpeedMultiplier(1.3);
        wolf.setDamageMultiplier(1.5);
      }
      this.enemies.push(wolf);
    }
  }

  private createClearingItems(def: ClearingDef): void {
    const gs = GameState.get(this);

    for (const itemDef of def.items) {
      // Skip aldric_journal_3 if already discovered
      if (itemDef.itemId === 'aldric_journal_3' && gs.aldricJournal.isDiscovered('aldric_journal_3')) {
        continue;
      }

      const sprite = this.add.rectangle(itemDef.x, itemDef.y, 16, 16, 0xffdd44);
      sprite.setDepth(5);
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.5, to: 1.0 },
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });

      const label = this.add.text(itemDef.x, itemDef.y - 16, itemDef.label, {
        fontSize: fs(20),
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5).setDepth(6);

      this.itemPickups.push({ def: itemDef, sprite, label });
    }
  }

  // --- Player Movement ---

  private handlePlayerMovement(): void {
    this.combatSystem.update(this.game.loop.delta);
    if (this.combatSystem.isKnockedBack()) return;

    let dx = 0;
    let dy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) dx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) dx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) dy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        this.playerFacing = dx > 0 ? 'right' : 'left';
      } else {
        this.playerFacing = dy > 0 ? 'down' : 'up';
      }

      const animKey = `${TextureKeys.PLAYER}_walk_${this.playerFacing}`;
      if (this.player.anims && this.player.anims.currentAnim?.key !== animKey) {
        this.player.anims.play(animKey, true);
      }
    } else {
      this.player.anims.stop();
      const dirFrameMap: Record<string, number> = { down: 0, left: 3, right: 6, up: 9 };
      this.player.setFrame(dirFrameMap[this.playerFacing] ?? 0);
    }

    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.player.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);
  }

  // --- Combat ---

  private handlePlayerAttack(): void {
    const zone = this.combatSystem.attack(this.playerFacing);
    if (!zone) return;

    this.showAttackEffect(this.playerFacing);

    const colliders: Phaser.Physics.Arcade.Collider[] = [];
    for (const enemy of this.enemies) {
      if (enemy.isDead()) continue;
      const gs = GameState.get(this);
      const collider = this.physics.add.overlap(
        zone,
        enemy.sprite,
        () => {
          const damage = this.combatSystem.getAttackDamage(gs.inventory);
          if (damage > 0) {
            enemy.takeDamage(damage);
            this.showDamageNumber(enemy.sprite.x, enemy.sprite.y - 20, damage);
          }
        },
        undefined,
        this
      );
      colliders.push(collider);
    }
    this.time.delayedCall(100, () => {
      for (const c of colliders) {
        this.physics.world.removeCollider(c);
      }
    });
  }

  private showAttackEffect(facing: string): void {
    const offsets: Record<string, { x: number; y: number; angle: number }> = {
      up: { x: 0, y: -24, angle: 0 },
      down: { x: 0, y: 24, angle: 180 },
      left: { x: -24, y: 0, angle: 270 },
      right: { x: 24, y: 0, angle: 90 },
    };
    const offset = offsets[facing] ?? offsets.down;

    const slash = this.add.graphics();
    slash.setPosition(this.player.x + offset.x, this.player.y + offset.y);
    slash.setDepth(50);
    slash.lineStyle(3, 0xffffff, 0.8);
    slash.beginPath();
    slash.arc(0, 0, 16, Phaser.Math.DegToRad(offset.angle - 45), Phaser.Math.DegToRad(offset.angle + 45));
    slash.strokePath();

    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 200,
      onComplete: () => slash.destroy(),
    });
  }

  private showDamageNumber(x: number, y: number, damage: number): void {
    const dmgText = this.add.text(x, y, `-${damage}`, {
      fontSize: fs(34),
      color: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: window.devicePixelRatio,
    });
    dmgText.setOrigin(0.5);
    dmgText.setDepth(100);

    this.tweens.add({
      targets: dmgText,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => dmgText.destroy(),
    });
  }

  private checkEnemyAttacks(): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead()) continue;
      if (!enemy.canAttack()) continue;

      const dx = this.player.x - enemy.sprite.x;
      const dy = this.player.y - enemy.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= TILE_SIZE) {
        const gs = GameState.get(this);
        this.combatSystem.handlePlayerDamage(enemy.getEffectiveDamage(), {
          x: enemy.sprite.x,
          y: enemy.sprite.y,
        }, gs.inventory);
      }
    }
  }

  // --- Item Pickup ---

  private checkProximityPrompts(): void {
    const nearItem = this.getNearbyItemPickup();
    if (nearItem) {
      this.interactionPrompt.setPosition(nearItem.def.x, nearItem.def.y - 24);
      this.interactionPrompt.setText(`[E] Pick up ${nearItem.def.label}`);
      this.interactionPrompt.setVisible(true);
    } else {
      this.interactionPrompt.setVisible(false);
    }
  }

  private getNearbyItemPickup(): ItemPickupInstance | null {
    for (const pickup of this.itemPickups) {
      const dx = this.player.x - pickup.def.x;
      const dy = this.player.y - pickup.def.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE) {
        return pickup;
      }
    }
    return null;
  }

  private tryPickupItem(): boolean {
    const gs = GameState.get(this);
    for (let i = this.itemPickups.length - 1; i >= 0; i--) {
      const pickup = this.itemPickups[i];
      const dx = this.player.x - pickup.def.x;
      const dy = this.player.y - pickup.def.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE) {
        gs.inventory.addItem(pickup.def.itemId, pickup.def.quantity ?? 1);
        this.tweens.killTweensOf(pickup.sprite);
        pickup.sprite.setVisible(false);
        pickup.sprite.destroy();
        pickup.label.setVisible(false);
        pickup.label.destroy();
        this.itemPickups.splice(i, 1);
        EventBus.emit(Events.SHOW_NOTIFICATION, { message: `Picked up: ${pickup.def.label}` });

        // Handle journal page discovery
        if (pickup.def.itemId === 'aldric_journal_3') {
          gs.aldricJournal.discoverPage('aldric_journal_3');
          EventBus.emit(Events.ITEM_ACQUIRED, { itemId: 'aldric_journal_3' });
        }

        return true;
      }
    }
    return false;
  }

  // --- Clearing Transitions ---

  private checkClearingExit(): void {
    if (this.transitioning) return;

    const def = CLEARING_DEFS[this.currentClearing];

    for (const exit of def.exits) {
      let triggered = false;

      switch (exit.direction) {
        case 'north':
          triggered = this.player.y < 40;
          break;
        case 'south':
          triggered = this.player.y > GAME_HEIGHT - 40;
          break;
        case 'east':
          triggered = this.player.x > GAME_WIDTH - 40;
          break;
        case 'west':
          triggered = this.player.x < 40;
          break;
      }

      if (!triggered) continue;

      if (exit.target === 'world') {
        // Return to village with zone prompt
        this.player.setVelocity(0, 0);
        this.showZonePrompt('Return to Thornwick Village?', () => {
          this.cleanupEvents();
          this.scene.stop('HUDScene');
          this.cameras.main.fadeOut(400);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.scene.start('WorldScene', {
              spawnX: GAME_WIDTH / 2,
              spawnY: 60,
            });
          });
        });
      } else {
        // Seamless sub-zone transition
        this.transitionToClearing(exit.target, exit.direction);
      }
      return;
    }
  }

  private transitionToClearing(targetClearing: number, fromDirection: string): void {
    if (this.transitioning) return;
    this.transitioning = true;

    this.player.setVelocity(0, 0);

    this.cameras.main.fadeOut(200);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.currentClearing = targetClearing;
      this.loadClearing();

      // Position player at opposite edge
      switch (fromDirection) {
        case 'north':
          this.player.setPosition(this.player.x, GAME_HEIGHT - 60);
          break;
        case 'south':
          this.player.setPosition(this.player.x, 60);
          break;
        case 'east':
          this.player.setPosition(60, this.player.y);
          break;
        case 'west':
          this.player.setPosition(GAME_WIDTH - 60, this.player.y);
          break;
      }

      this.cameras.main.fadeIn(200);
      this.transitioning = false;
    });
  }

  private showZonePrompt(message: string, onConfirm: () => void): void {
    this.transitioning = true;
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 150, 0x000000, 0.85);
    bg.setDepth(200);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, message, {
      fontSize: fs(38),
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 380 },
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(201);
    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '[Y] Yes    [N] No', {
      fontSize: fs(30),
      color: '#aaaaaa',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(201);

    const yKey = this.input.keyboard!.addKey('Y');
    const nKey = this.input.keyboard!.addKey('N');

    const cleanup = () => {
      bg.destroy();
      text.destroy();
      hint.destroy();
      yKey.removeAllListeners();
      nKey.removeAllListeners();
      this.input.keyboard!.removeKey('Y');
      this.input.keyboard!.removeKey('N');
    };

    yKey.once('down', () => {
      cleanup();
      onConfirm();
    });
    nKey.once('down', () => {
      cleanup();
      this.transitioning = false;
      this.player.setPosition(this.player.x, GAME_HEIGHT - 80);
    });
  }

  // --- Death ---

  private handlePlayerDeath(): void {
    this.combatSystem.resetHealth();
    this.cleanupEvents();
    this.scene.stop('HUDScene');

    EventBus.emit(Events.SHOW_NOTIFICATION, 'You have fallen... Returning to village.');

    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('WorldScene', {
        spawnX: GAME_WIDTH / 2,
        spawnY: GAME_HEIGHT / 2,
      });
    });
  }
}
