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
    { itemId: 'wolf_pelt', quantity: 1, chance: 0.6 },
    { itemId: 'raw_iron', quantity: 1, chance: 0.2 },
    { itemId: 'gold', quantity: 5, chance: 0.5 },
    { itemId: 'plant_fiber', quantity: 2, chance: 0.4 },
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
  private deathTween: Phaser.Tweens.Tween | null = null;
  private speedMultiplier = 1.0;
  private damageMultiplier = 1.0;

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

    this.scene.events.once('shutdown', () => {
      if (this.dead) {
        this.cleanup();
      }
    });
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
      this.config.speed * this.speedMultiplier
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

    // Add hit spark particles
    if (this.scene.textures.exists('particle_spark')) {
      const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, 'particle_spark', {
        emitting: false,
        lifespan: { min: 150, max: 350 },
        speed: { min: 80, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffdd00, 0xff8800, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
      });
      emitter.setDepth(20);
      emitter.explode(8, this.sprite.x, this.sprite.y);
      this.scene.time.delayedCall(400, () => emitter.destroy());
    }

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

  setSpeedMultiplier(mult: number): void {
    this.speedMultiplier = mult;
  }

  setDamageMultiplier(mult: number): void {
    this.damageMultiplier = mult;
  }

  getEffectiveDamage(): number {
    return Math.round(this.config.damage * this.damageMultiplier);
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

    if (this.scene.textures.exists('particle_spark')) {
      const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, 'particle_spark', {
        emitting: false,
        lifespan: { min: 300, max: 600 },
        speed: { min: 50, max: 150 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xff4400, 0xff0000, 0xffaa00],
        blendMode: Phaser.BlendModes.ADD,
      });
      emitter.setDepth(20);
      emitter.explode(15, this.sprite.x, this.sprite.y);
      this.scene.time.delayedCall(700, () => emitter.destroy());
    }

    EventBus.emit(Events.ENTITY_DIED, {
      entity: this.config.name,
      drops: this.getDrops(),
    });

    this.deathTween = this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 500,
      onComplete: () => {
        this.deathTween = null;
        this.cleanup();
      },
    });

    this.healthBar.setVisible(false);
  }

  private cleanup(): void {
    if (this.deathTween) {
      this.deathTween.stop();
      this.deathTween = null;
    }
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }
    if (this.healthBar) {
      this.healthBar.destroy();
    }
  }

  destroy(): void {
    this.cleanup();
  }
}
