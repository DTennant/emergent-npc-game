import Phaser from 'phaser';
import { EnemyConfig, Enemy } from '../combat/Enemy';
import { HealthBar } from '../combat/HealthBar';
import { EventBus, Events } from '../world/EventBus';
import { TILE_SIZE, GAME_WIDTH } from '../config';
import { TextureKeys } from '../assets/keys';

export interface BossConfig extends EnemyConfig {
  bossName: string;
  runestoneId: string;
  phases?: number;
}

export const BOSS_CONFIGS: Record<string, BossConfig> = {
  boss_shadow_wolf: {
    bossName: 'Shadow Wolf',
    name: 'Shadow Wolf',
    runestoneId: 'runestone_forest',
    maxHealth: 100,
    damage: 15,
    speed: 120,
    aggroRange: TILE_SIZE * 8,
    attackCooldown: 1000,
    drops: [
      { itemId: 'runestone_forest', quantity: 1, chance: 1 },
      { itemId: 'wolf_pelt', quantity: 3, chance: 1 },
      { itemId: 'gold', quantity: 20, chance: 1 },
      { itemId: 'enchantment_dust', quantity: 1, chance: 0.5 },
    ],
  },
  boss_crystal_golem: {
    bossName: 'Crystal Golem',
    name: 'Crystal Golem',
    runestoneId: 'runestone_mine',
    maxHealth: 200,
    damage: 25,
    speed: 40,
    aggroRange: TILE_SIZE * 6,
    attackCooldown: 2500,
    drops: [
      { itemId: 'runestone_mine', quantity: 1, chance: 1 },
      { itemId: 'raw_iron', quantity: 5, chance: 1 },
      { itemId: 'gold', quantity: 30, chance: 1 },
      { itemId: 'enchantment_dust', quantity: 2, chance: 0.5 },
      { itemId: 'stone', quantity: 5, chance: 0.8 },
    ],
  },
  boss_blight_wraith: {
    bossName: 'Blight Wraith',
    name: 'Blight Wraith',
    runestoneId: 'runestone_tower',
    maxHealth: 120,
    damage: 20,
    speed: 100,
    aggroRange: TILE_SIZE * 10,
    attackCooldown: 800,
    drops: [
      { itemId: 'runestone_tower', quantity: 1, chance: 1 },
      { itemId: 'enchantment_dust', quantity: 3, chance: 1 },
      { itemId: 'gold', quantity: 25, chance: 1 },
      { itemId: 'moonpetal', quantity: 2, chance: 0.7 },
      { itemId: 'glass_vial', quantity: 2, chance: 0.6 },
    ],
  },
};

const BOSS_TEXTURE_MAP: Record<string, string> = {
  boss_shadow_wolf: TextureKeys.BOSS_SHADOW_WOLF,
  boss_crystal_golem: TextureKeys.BOSS_CRYSTAL_GOLEM,
  boss_blight_wraith: TextureKeys.BOSS_BLIGHT_WRAITH,
};

export class BossEnemy {
  private enemy: Enemy;
  private scene: Phaser.Scene;
  private config: BossConfig;
  private bossHealthBar: HealthBar;
  private bossNameText: Phaser.GameObjects.Text;
  private dead = false;
  private damageHandler: (data: { entity: string; currentHealth: number }) => void;
  private deathHandler: (data: { entity: string }) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, bossType: string) {
    this.scene = scene;
    this.config = BOSS_CONFIGS[bossType];

    const textureKey = BOSS_TEXTURE_MAP[bossType] ?? TextureKeys.ENEMY_WOLF;
    this.enemy = new Enemy(scene, x, y, textureKey, this.config);

    this.bossNameText = scene.add.text(GAME_WIDTH / 2, 20, this.config.bossName, {
      fontSize: '16px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
      resolution: window.devicePixelRatio,
    });
    this.bossNameText.setOrigin(0.5);
    this.bossNameText.setDepth(110);
    this.bossNameText.setScrollFactor(0);

    this.bossHealthBar = new HealthBar(
      scene,
      GAME_WIDTH / 2,
      40,
      GAME_WIDTH * 0.6,
      8,
      this.config.maxHealth
    );

    this.damageHandler = (data) => {
      if (data.entity === this.config.name) {
        this.bossHealthBar.setHealth(data.currentHealth);
      }
    };
    EventBus.on(Events.ENTITY_DAMAGED, this.damageHandler);

    this.deathHandler = (data) => {
      if (data.entity === this.config.name) {
        this.dead = true;
        this.bossHealthBar.setHealth(0);

        this.scene.time.delayedCall(500, () => {
          this.bossHealthBar.destroy();
          this.bossNameText.destroy();
        });

        EventBus.emit(Events.SHOW_NOTIFICATION, {
          message: `${this.config.bossName} has been defeated!`,
        });

        this.removeListeners();
      }
    };
    EventBus.on(Events.ENTITY_DIED, this.deathHandler);
  }

  get sprite(): Phaser.Physics.Arcade.Sprite {
    return this.enemy.sprite;
  }

  update(delta: number, playerX: number, playerY: number): void {
    if (this.dead) return;
    this.enemy.update(delta, playerX, playerY);
  }

  takeDamage(amount: number): void {
    if (this.dead) return;
    this.enemy.takeDamage(amount);
  }

  canAttack(): boolean {
    return this.enemy.canAttack();
  }

  getConfig(): BossConfig {
    return this.config;
  }

  isDead(): boolean {
    return this.dead || this.enemy.isDead();
  }

  destroy(): void {
    this.removeListeners();
    this.enemy.destroy();
    this.bossHealthBar.destroy();
    this.bossNameText.destroy();
  }

  private removeListeners(): void {
    EventBus.off(Events.ENTITY_DAMAGED, this.damageHandler);
    EventBus.off(Events.ENTITY_DIED, this.deathHandler);
  }
}
