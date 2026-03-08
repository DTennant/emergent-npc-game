import Phaser from 'phaser';
import { DungeonDef, DungeonRoom, DUNGEONS } from '../dungeons/DungeonData';
import { BossEnemy, BOSS_CONFIGS } from '../dungeons/BossEnemy';
import { Enemy, WOLF_CONFIG } from '../combat/Enemy';
import { CombatSystem } from '../combat/CombatSystem';
import { HealthBar } from '../combat/HealthBar';
import { Inventory } from '../inventory/Inventory';
import { TextureKeys } from '../assets/keys';
import { EventBus, Events } from '../world/EventBus';
import { GameState } from '../world/GameState';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  PLAYER_SPEED,
  PLAYER_MAX_HEALTH,
  INVINCIBILITY_MS,
  fs,
} from '../config';

interface DungeonInitData {
  dungeonId: string;
  inventory: Inventory;
}

export class DungeonScene extends Phaser.Scene {
  private dungeonDef!: DungeonDef;
  private inventory!: Inventory;
  private combatSystem!: CombatSystem;
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerHealthBar!: HealthBar;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private playerFacing = 'down';
  private currentRoom = 0;
  private enemies: Enemy[] = [];
  private boss: BossEnemy | null = null;
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private doorZone: Phaser.GameObjects.Zone | null = null;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private roomLabel!: Phaser.GameObjects.Text;
  private escLabel!: Phaser.GameObjects.Text;
  private dungeonCleared = false;
  private loadingRoom = false;
  private cleanedUp = false;
  private notificationText!: Phaser.GameObjects.Text;
  private notificationTimer = 0;
  private notificationHandler!: (data: string | { message?: string; text?: string }) => void;
  private deathHandler!: () => void;
  private entityDiedHandler!: (data: { entity: string; drops: { itemId: string; quantity: number }[] }) => void;

  constructor() {
    super({ key: 'DungeonScene' });
  }

  init(data: DungeonInitData): void {
    const def = DUNGEONS.find((d) => d.id === data.dungeonId);
    if (!def) {
      this.scene.start('WoodsScene');
      return;
    }
    this.dungeonDef = def;
    this.inventory = data.inventory;
    this.currentRoom = 0;
    this.dungeonCleared = false;
    this.cleanedUp = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(this.dungeonDef.bgColor);
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(500);

    this.player = this.physics.add.sprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      TextureKeys.PLAYER
    );
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);

    this.combatSystem = new CombatSystem(this, this.player);

    this.playerHealthBar = new HealthBar(
      this,
      this.player.x,
      this.player.y - TILE_SIZE,
      TILE_SIZE,
      4,
      PLAYER_MAX_HEALTH
    );

    this.wallGroup = this.physics.add.staticGroup();
    this.obstacleGroup = this.physics.add.staticGroup();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.roomLabel = this.add.text(10, 10, '', {
      fontSize: fs(30),
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.roomLabel.setDepth(100);
    this.roomLabel.setScrollFactor(0);

    this.escLabel = this.add.text(GAME_WIDTH - 10, 10, '[ESC] Exit Dungeon', {
      fontSize: fs(26),
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.escLabel.setOrigin(1, 0);
    this.escLabel.setDepth(100);
    this.escLabel.setScrollFactor(0);

    this.notificationText = this.add.text(GAME_WIDTH / 2, 60, '', {
      fontSize: fs(28),
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000088',
      padding: { x: 16, y: 8 },
      resolution: window.devicePixelRatio,
    });
    this.notificationText.setOrigin(0.5);
    this.notificationText.setDepth(100);
    this.notificationText.setScrollFactor(0);
    this.notificationText.setVisible(false);

    this.notificationHandler = (data: string | { message?: string; text?: string }) => {
      const msg = typeof data === 'string' ? data : (data.message ?? data.text ?? '');
      this.notificationText.setText(msg);
      this.notificationText.setVisible(true);
      this.notificationTimer = 3000;
    };
    EventBus.on(Events.SHOW_NOTIFICATION, this.notificationHandler);

    this.spaceKey.on('down', () => {
      this.handlePlayerAttack();
    });

    this.escKey.on('down', () => {
      this.exitDungeon();
    });

    this.deathHandler = () => {
      this.handlePlayerDeath();
    };
    EventBus.on(Events.PLAYER_DIED, this.deathHandler);

    this.entityDiedHandler = (data) => {
      for (const drop of data.drops) {
        this.inventory.addItem(drop.itemId, drop.quantity);
      }
    };
    EventBus.on(Events.ENTITY_DIED, this.entityDiedHandler);

    this.loadRoom(0);

    const gs = GameState.get(this);
    gs.currentZone = 'dungeon';
    gs.storylineManager.discoverDungeon(this.dungeonDef.id);
  }

  update(_time: number, delta: number): void {
    const gs = GameState.get(this);
    gs.playerPosition = { x: this.player.x, y: this.player.y };

    this.handlePlayerMovement();

    for (const enemy of this.enemies) {
      if (!enemy.isDead()) {
        enemy.update(delta, this.player.x, this.player.y);
      }
    }

    if (this.boss && !this.boss.isDead()) {
      this.boss.update(delta, this.player.x, this.player.y);
    }

    if (this.boss && this.boss.isDead() && !this.dungeonCleared) {
      this.dungeonCleared = true;
      this.onBossDefeated();
    }

    this.checkEnemyAttacks();

    if (this.notificationTimer > 0) {
      this.notificationTimer -= delta;
      if (this.notificationTimer <= 0) {
        this.notificationText.setVisible(false);
      }
    }

    this.playerHealthBar.setPosition(this.player.x, this.player.y - TILE_SIZE);
    this.playerHealthBar.setHealth(this.combatSystem.getHealth());
  }

  private loadRoom(roomIndex: number): void {
    this.clearRoom();
    this.currentRoom = roomIndex;

    const room = this.dungeonDef.rooms[roomIndex];
    if (!room) return;

    const isBossRoom = roomIndex === this.dungeonDef.bossRoom;
    this.roomLabel.setText(
      `${this.dungeonDef.name} — Room ${roomIndex + 1}/${this.dungeonDef.rooms.length}` +
      (isBossRoom ? ' [BOSS]' : '')
    );

    for (const wall of room.walls) {
      const rect = this.add.rectangle(
        wall.x + wall.w / 2,
        wall.y + wall.h / 2,
        wall.w,
        wall.h,
        0x444444
      );
      rect.setDepth(1);
      this.roomObjects.push(rect);

      const wallBody = this.wallGroup.create(
        wall.x + wall.w / 2,
        wall.y + wall.h / 2,
        undefined
      ) as Phaser.Physics.Arcade.Sprite;
      wallBody.setVisible(false);
      const body = wallBody.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(wall.w, wall.h);
      body.setOffset(-wall.w / 2, -wall.h / 2);
    }

    for (const obs of room.obstacles) {
      const rect = this.add.rectangle(
        obs.x + obs.w / 2,
        obs.y + obs.h / 2,
        obs.w,
        obs.h,
        0x666633
      );
      rect.setDepth(1);
      this.roomObjects.push(rect);

      const obsBody = this.obstacleGroup.create(
        obs.x + obs.w / 2,
        obs.y + obs.h / 2,
        undefined
      ) as Phaser.Physics.Arcade.Sprite;
      obsBody.setVisible(false);
      const body = obsBody.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(obs.w, obs.h);
      body.setOffset(-obs.w / 2, -obs.h / 2);
    }

    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.obstacleGroup);

    for (const enemyDef of room.enemies) {
      if (enemyDef.type.startsWith('boss_')) {
        this.boss = new BossEnemy(this, enemyDef.x, enemyDef.y, enemyDef.type);
        this.physics.add.collider(this.boss.sprite, this.wallGroup);
        this.physics.add.collider(this.boss.sprite, this.obstacleGroup);
      } else {
        const enemy = new Enemy(
          this,
          enemyDef.x,
          enemyDef.y,
          TextureKeys.ENEMY_WOLF,
          WOLF_CONFIG
        );
        this.physics.add.collider(enemy.sprite, this.wallGroup);
        this.physics.add.collider(enemy.sprite, this.obstacleGroup);
        this.enemies.push(enemy);
      }
    }

    if (room.doorTo !== undefined) {
      const doorPos = room.doorPosition;
      const doorRect = this.add.rectangle(
        doorPos.x,
        doorPos.y,
        TILE_SIZE * 2,
        TILE_SIZE * 4,
        0x00aa00,
        0.3
      );
      doorRect.setDepth(0);
      this.roomObjects.push(doorRect);

      this.doorZone = this.add.zone(doorPos.x, doorPos.y, TILE_SIZE * 2, TILE_SIZE * 4);
      this.physics.add.existing(this.doorZone, true);

      const nextRoom = room.doorTo;
      this.physics.add.overlap(
        this.player,
        this.doorZone,
        () => {
          if (this.loadingRoom) return;
          const aliveEnemies = this.enemies.filter((e) => !e.isDead());
          if (aliveEnemies.length > 0) {
            EventBus.emit(Events.SHOW_NOTIFICATION, {
              message: `Defeat all enemies first! (${aliveEnemies.length} remaining)`,
            });
            return;
          }
          this.loadingRoom = true;
          this.loadRoom(nextRoom);
        },
        undefined,
        this
      );

      const doorLabel = this.add.text(doorPos.x, doorPos.y - TILE_SIZE * 2.5, 'Next Room →', {
        fontSize: fs(24),
        color: '#00ff00',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      });
      doorLabel.setOrigin(0.5);
      doorLabel.setDepth(15);
      this.roomObjects.push(doorLabel);
    }

    this.player.setPosition(room.spawnPoint.x, room.spawnPoint.y);
    this.loadingRoom = false;
  }

  private clearRoom(): void {
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];

    if (this.boss) {
      this.boss.destroy();
      this.boss = null;
    }

    if (this.doorZone) {
      this.doorZone.destroy();
      this.doorZone = null;
    }

    for (const obj of this.roomObjects) {
      obj.destroy();
    }
    this.roomObjects = [];

    this.wallGroup.clear(true, true);
    this.obstacleGroup.clear(true, true);
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
    }

    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.player.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);
  }

  private handlePlayerAttack(): void {
    const zone = this.combatSystem.attack(this.playerFacing);
    if (!zone) return;

    const allTargets: Array<Enemy | BossEnemy> = [...this.enemies];
    if (this.boss && !this.boss.isDead()) {
      allTargets.push(this.boss);
    }

    const colliders: Phaser.Physics.Arcade.Collider[] = [];
    for (const target of allTargets) {
      if (target.isDead()) continue;
      const collider = this.physics.add.overlap(
        zone,
        target.sprite,
        () => {
          const damage = this.combatSystem.getAttackDamage(this.inventory);
          if (damage > 0) {
            target.takeDamage(damage);
            this.showDamageNumber(target.sprite.x, target.sprite.y - 20, damage);
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
    const allTargets: Array<Enemy | BossEnemy> = [...this.enemies];
    if (this.boss && !this.boss.isDead()) {
      allTargets.push(this.boss);
    }

    for (const target of allTargets) {
      if (target.isDead()) continue;
      if (!target.canAttack()) continue;

      const dx = this.player.x - target.sprite.x;
      const dy = this.player.y - target.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= TILE_SIZE) {
        const damage = target.getEffectiveDamage();
        this.combatSystem.handlePlayerDamage(damage, {
          x: target.sprite.x,
          y: target.sprite.y,
        }, this.inventory);
      }
    }
  }

  private onBossDefeated(): void {
    EventBus.emit(Events.SHOW_NOTIFICATION, {
      message: `Runestone acquired! ${this.dungeonDef.name} cleared!`,
    });

    const gs = GameState.get(this);
    gs.storylineManager.clearDungeon(this.dungeonDef.id);

    this.time.delayedCall(3000, () => {
      this.exitDungeon();
    });
  }

  private handlePlayerDeath(): void {
    this.combatSystem.resetHealth();
    this.exitDungeon();
    EventBus.emit(Events.SHOW_NOTIFICATION, {
      message: 'You have fallen in the dungeon... Returning to village.',
    });
  }

  private exitDungeon(): void {
    this.cleanup();
    this.scene.start('WoodsScene', { spawnX: GAME_WIDTH / 2, spawnY: GAME_HEIGHT / 2 });
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    EventBus.off(Events.PLAYER_DIED, this.deathHandler);
    EventBus.off(Events.ENTITY_DIED, this.entityDiedHandler);
    EventBus.off(Events.SHOW_NOTIFICATION, this.notificationHandler);
    this.clearRoom();
    this.playerHealthBar.destroy();
  }

  shutdown(): void {
    this.cleanup();
  }
}
