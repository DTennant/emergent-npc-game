import Phaser from 'phaser';
import { GameState } from '../world/GameState';
import { BlightSystem } from '../world/BlightSystem';
import { EventBus, Events } from '../world/EventBus';
import { TextureKeys } from '../assets/keys';
import { CombatSystem } from '../combat/CombatSystem';
import { HealthBar } from '../combat/HealthBar';
import { Enemy, WOLF_CONFIG } from '../combat/Enemy';
import { DUNGEONS } from '../dungeons/DungeonData';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  PLAYER_SPEED,
  INTERACTION_DISTANCE,
  COLORS,
  PLAYER_MAX_HEALTH,
  INVINCIBILITY_MS,
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

interface WoodsSceneInitData {
  spawnX?: number;
  spawnY?: number;
}

export class WoodsScene extends Phaser.Scene {
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
  private dungeonEntranceZones: Phaser.GameObjects.Zone[] = [];
  private itemPickups: ItemPickupInstance[] = [];
  private interactionPrompt!: Phaser.GameObjects.Text;
  private transitioning = false;
  private inInventory = false;
  private spawnX = 60;
  private spawnY = GAME_HEIGHT / 2;
  private blightParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor() {
    super({ key: 'WoodsScene' });
  }

  init(data?: WoodsSceneInitData): void {
    this.spawnX = data?.spawnX ?? 60;
    this.spawnY = data?.spawnY ?? GAME_HEIGHT / 2;
    this.transitioning = false;
    this.inInventory = false;
    this.enemies = [];
    this.dungeonEntranceZones = [];
    this.itemPickups = [];
  }

  create(): void {
    const gs = GameState.get(this);
    gs.currentZone = 'woods';

    this.createForestWorld();

    this.blightSystem = new BlightSystem(this);

    // Create blight ambient particle emitter (always active in woods, scaled by intensity)
    if (this.textures.exists('particle_circle')) {
      this.blightParticles = this.add.particles(0, 0, 'particle_circle', {
        emitting: false,
        lifespan: { min: 2000, max: 4000 },
        frequency: 200,
        quantity: 1,
        speed: { min: 10, max: 30 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.4, end: 1.2 },
        alpha: { start: 0.6, end: 0 },
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

    this.createDungeonEntrances();
    this.spawnEnemies();
    this.createItemPickups();

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

    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(400);
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;

    const gs = GameState.get(this);
    gs.worldState.update(delta);
    gs.playerPosition = { x: this.player.x, y: this.player.y };

    if (this.blightParticles) {
      const intensity = Math.max(0.3, this.blightSystem?.getIntensity() ?? 0);
      this.blightParticles.emitting = true;
      this.blightParticles.frequency = Math.max(30, 400 - intensity * 350);
      this.blightParticles.quantity = Math.ceil(intensity * 4);
    }

    this.handlePlayerMovement();

    for (const enemy of this.enemies) {
      if (!enemy.isDead()) {
        enemy.update(delta, this.player.x, this.player.y);
      }
    }

    this.checkEnemyAttacks();
    this.checkProximityPrompts();
    this.checkZoneExit();

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

  private createForestWorld(): void {
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
          const shade = 0.7 + Math.random() * 0.3;
          const r = Math.floor(0x1a * shade);
          const g = Math.floor(0x3a * shade);
          const b = Math.floor(0x0a * shade);
          const color = (r << 16) | (g << 8) | b;
          this.add.rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, color).setDepth(0);
        }
      }
    }

    this.scatterTrees();

    this.add
      .text(GAME_WIDTH / 2, 20, '\uD83C\uDF32 Dark Woods', {
        fontSize: fs(34),
        color: '#88ff88',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5)
      .setDepth(15);

    const exitHint = this.add.text(10, GAME_HEIGHT / 2, '\u2190 Village', {
      fontSize: fs(24),
      color: '#aaffaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    exitHint.setOrigin(0, 0.5);
    exitHint.setDepth(15);
    this.tweens.add({
      targets: exitHint,
      alpha: { from: 0.4, to: 1.0 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });
  }

  private scatterTrees(): void {
    const treePositions = [
      { x: 200, y: 100 }, { x: 500, y: 80 }, { x: 900, y: 60 },
      { x: 150, y: 300 }, { x: 700, y: 250 }, { x: 1100, y: 200 },
      { x: 300, y: 500 }, { x: 850, y: 450 }, { x: 1050, y: 500 },
      { x: 400, y: 700 }, { x: 650, y: 750 }, { x: 1000, y: 700 },
      { x: 250, y: 850 }, { x: 550, y: 900 }, { x: 1150, y: 850 },
    ];

    const forestTreeKeys = ['forest_tree1', 'forest_tree2', 'forest_tree3', 'forest_tree4'];
    const hasForestTrees = forestTreeKeys.some((k) => this.textures.exists(k));

    for (const pos of treePositions) {
      if (hasForestTrees) {
        const available = forestTreeKeys.filter((k) => this.textures.exists(k));
        for (let dx = 0; dx < 2; dx++) {
          for (let dy = 0; dy < 2; dy++) {
            const key = available[Math.floor(Math.random() * available.length)];
            this.add.image(pos.x + dx * 32, pos.y + dy * 32, key).setDepth(2);
          }
        }
      } else if (this.textures.exists('tile_tree')) {
        const tree = this.add.image(pos.x, pos.y, 'tile_tree');
        tree.setScale(3);
        tree.setDepth(2);
        tree.setAlpha(0.8);
      } else {
        const trunk = this.add.rectangle(pos.x, pos.y + 8, 8, 20, 0x3a2a1a);
        trunk.setDepth(2);
        const canopy = this.add.circle(pos.x, pos.y - 8, 16, 0x1a4a1a, 0.9);
        canopy.setDepth(2);
      }
    }
  }

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

  private spawnEnemies(): void {
    const count = this.blightSystem.getWolfSpawnCount();
    for (let i = 0; i < count; i++) {
      const x = 200 + Math.random() * (GAME_WIDTH - 400);
      const y = 150 + Math.random() * (GAME_HEIGHT - 300);
      const wolf = new Enemy(this, x, y, TextureKeys.ENEMY_WOLF, WOLF_CONFIG);
      this.enemies.push(wolf);
    }
  }

  private createDungeonEntrances(): void {
    const entranceDefs = [
      { dungeonId: 'forest_cave', x: 1200, y: 300, w: 50, h: 50, color: 0x1a3a0a, label: '\uD83D\uDD73\uFE0F Forest Cave' },
      { dungeonId: 'abandoned_mine', x: 1100, y: 800, w: 50, h: 50, color: 0x3a3a3a, label: '\u26CF\uFE0F Abandoned Mine' },
      { dungeonId: 'ruined_tower', x: 800, y: 150, w: 50, h: 50, color: 0x3a0a3a, label: '\uD83C\uDFF0 Ruined Tower' },
    ];

    for (const ent of entranceDefs) {
      const dungeon = DUNGEONS.find((d) => d.id === ent.dungeonId);
      if (!dungeon) continue;

      const rect = this.add.rectangle(ent.x, ent.y, ent.w, ent.h, ent.color, 0.7);
      rect.setDepth(1);
      rect.setStrokeStyle(2, 0xffffff, 0.3);

      const label = this.add.text(ent.x, ent.y - ent.h / 2 - 10, ent.label, {
        fontSize: fs(22),
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      });
      label.setOrigin(0.5);
      label.setDepth(15);

      const zone = this.add.zone(ent.x, ent.y, ent.w, ent.h);
      this.physics.add.existing(zone, true);
      this.dungeonEntranceZones.push(zone);

      this.physics.add.overlap(
        this.player,
        zone,
        () => {
          this.tryEnterDungeon(dungeon.id, dungeon.requiredItem, dungeon.name);
        },
        undefined,
        this
      );
    }
  }

  private tryEnterDungeon(dungeonId: string, requiredItem: string, dungeonName: string): void {
    if (this.transitioning || this.inInventory) return;

    const gs = GameState.get(this);
    if (!gs.inventory.hasItem(requiredItem)) {
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `You need a ${requiredItem.replace('_', ' ')} to enter ${dungeonName}.`,
      });
      this.player.setPosition(this.player.x - 40, this.player.y);
      return;
    }

    this.transitioning = true;
    this.cleanupEvents();
    this.scene.stop('HUDScene');
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('DungeonScene', {
        dungeonId,
        inventory: gs.inventory,
      });
    });
  }

  private createItemPickups(): void {
    const gs = GameState.get(this);
    const pickups: ItemPickupDef[] = [
      { itemId: 'lantern', x: 1100, y: 350, label: 'Lantern' },
      { itemId: 'rope', x: 900, y: 800, label: 'Rope' },
      { itemId: 'health_potion', x: 400, y: 600, label: 'Health Potion' },
      { itemId: 'moonpetal', x: 650, y: 150, label: 'Moonpetal' },
      { itemId: 'wood', x: 300, y: 300, label: 'Wood' },
      { itemId: 'wood', x: 800, y: 600, label: 'Wood' },
      { itemId: 'stone', x: 550, y: 450, label: 'Stone' },
      { itemId: 'plant_fiber', x: 200, y: 700, label: 'Plant Fiber' },
      { itemId: 'plant_fiber', x: 1000, y: 400, label: 'Plant Fiber' },
      { itemId: 'raw_iron', x: 1150, y: 600, label: 'Raw Iron' },
      { itemId: 'glass_vial', x: 750, y: 350, label: 'Glass Vial' },
    ];

    for (const def of pickups) {
      if (def.itemId !== 'health_potion' && gs.inventory.hasItem(def.itemId)) continue;

      const sprite = this.add.rectangle(def.x, def.y, 16, 16, 0xffdd44);
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

      const label = this.add.text(def.x, def.y - 16, def.label, {
        fontSize: fs(20),
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5).setDepth(6);

      this.itemPickups.push({ def, sprite, label });
    }
  }

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
        return true;
      }
    }
    return false;
  }

  private checkZoneExit(): void {
    if (this.transitioning) return;
    if (this.player.x < 40) {
      this.player.setVelocity(0, 0);
      this.showZonePrompt('Return to Thornwick Village?', () => {
        this.cleanupEvents();
        this.scene.stop('HUDScene');
        this.cameras.main.fadeOut(400);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start('WorldScene', {
            spawnX: GAME_WIDTH - 60,
            spawnY: this.player.y,
          });
        });
      });
    }
  }

  private showZonePrompt(message: string, onConfirm: () => void): void {
    this.transitioning = true;
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 150, 0x000000, 0.85);
    bg.setDepth(200);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, message, {
      fontSize: fs(38),
      color: '#ffffff',
      align: 'center',
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
      this.player.setPosition(80, this.player.y);
    });
  }

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
        const gs2 = GameState.get(this);
        this.combatSystem.handlePlayerDamage(enemy.getEffectiveDamage(), {
          x: enemy.sprite.x,
          y: enemy.sprite.y,
        }, gs2.inventory);
      }
    }
  }

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
