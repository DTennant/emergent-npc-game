import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { EnemyAI } from './EnemyAI';
import { EventBus, Events } from '../world/EventBus';
import { TILE_SIZE } from '../config';

export interface EnemyConfig {
  name: string;
  maxHealth: number;
  damage: number;
  speed: number;
  aggroRange: number;
  attackCooldown: number;
  drops: { itemId: string; quantity: number; chance: number }[];
}

export const WOLF_CONFIG: EnemyConfig = {
  name: 'Corrupted Wolf',
  maxHealth: 30,
  damage: 10,
  speed: 80,
  aggroRange: TILE_SIZE * 5,
  attackCooldown: 1500,
  drops: [
    { itemId: 'raw_iron', quantity: 1, chance: 0.3 },
    { itemId: 'health_potion', quantity: 1, chance: 0.2 },
  ],
};

export class Enemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private config: EnemyConfig;
  private currentHealth: number;
  private healthBar: HealthBar;
  private ai: EnemyAI;
  private dead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    config: EnemyConfig
  ) {
    this.scene = scene;
    this.config = config;
    this.currentHealth = config.maxHealth;

    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setDepth(5);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setTint(0xcc3333);

    this.healthBar = new HealthBar(
      scene,
      x,
      y - TILE_SIZE * 0.7,
      TILE_SIZE,
      3,
      config.maxHealth
    );

    this.ai = new EnemyAI(x, y);
  }

  update(delta: number, playerX: number, playerY: number): void {
    if (this.dead) return;

    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    const vel = this.ai.update(
      delta,
      distToPlayer,
      this.sprite.x,
      this.sprite.y,
      playerX,
      playerY,
      this.config.aggroRange,
      this.config.attackCooldown,
      this.config.speed
    );

    this.sprite.setVelocity(vel.vx, vel.vy);

    this.healthBar.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE * 0.7);
  }

  canAttack(): boolean {
    if (this.dead) return false;
    return this.ai.canAttack(this.scene.time.now, this.config.attackCooldown);
  }

  takeDamage(amount: number): void {
    if (this.dead) return;

    this.currentHealth = Math.max(0, this.currentHealth - amount);
    this.healthBar.setHealth(this.currentHealth);

    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (!this.dead) {
        this.sprite.setTint(0xcc3333);
      }
    });

    EventBus.emit(Events.ENTITY_DAMAGED, {
      entity: this.config.name,
      damage: amount,
      currentHealth: this.currentHealth,
      maxHealth: this.config.maxHealth,
    });

    if (this.currentHealth <= 0) {
      this.die();
    }
  }

  getDrops(): { itemId: string; quantity: number }[] {
    const results: { itemId: string; quantity: number }[] = [];
    for (const drop of this.config.drops) {
      if (Math.random() < drop.chance) {
        results.push({ itemId: drop.itemId, quantity: drop.quantity });
      }
    }
    return results;
  }

  getConfig(): EnemyConfig {
    return this.config;
  }

  isDead(): boolean {
    return this.dead;
  }

  private die(): void {
    this.dead = true;
    this.ai.die();
    this.sprite.setVelocity(0, 0);

    EventBus.emit(Events.ENTITY_DIED, {
      entity: this.config.name,
      drops: this.getDrops(),
    });

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 300,
      onStart: () => {
        this.sprite.setTint(0x222222);
      },
      onComplete: () => {
        this.cleanup();
      },
    });

    this.healthBar.setVisible(false);
  }

  private cleanup(): void {
    this.sprite.destroy();
    this.healthBar.destroy();
  }

  destroy(): void {
    this.cleanup();
  }
}
