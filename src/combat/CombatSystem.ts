import Phaser from 'phaser';
import { Inventory } from '../inventory/Inventory';
import { ITEMS, ItemDef } from '../inventory/types';
import { EventBus, Events } from '../world/EventBus';
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_RANGE,
  PLAYER_MAX_HEALTH,
  INVINCIBILITY_MS,
  TILE_SIZE,
  PLAYER_SPEED,
  DASH_SPEED_MULTIPLIER,
  DASH_DURATION_MS,
  DASH_COOLDOWN_MS,
} from '../config';

const CONSUMABLE_HEAL: Record<string, number> = {
  health_potion: 40,
  provisions: 20,
  blight_ward: 25,
};

export class CombatSystem {
  private scene: Phaser.Scene;
  private player: Phaser.Physics.Arcade.Sprite;
  private lastAttackTime = 0;
  private inIFrames = false;
  private currentHealth: number;
  private maxHealth: number;
  private knockbackTimer = 0;
  private isDashing = false;
  private dashTimer = 0;
  private dashCooldownTimer = 0;

  constructor(scene: Phaser.Scene, player: Phaser.Physics.Arcade.Sprite) {
    this.scene = scene;
    this.player = player;
    this.maxHealth = PLAYER_MAX_HEALTH;
    this.currentHealth = PLAYER_MAX_HEALTH;
  }

  attack(direction: string): Phaser.GameObjects.Zone | null {
    if (this.isOnCooldown()) return null;

    this.lastAttackTime = this.scene.time.now;

    let offsetX = 0;
    let offsetY = 0;
    switch (direction) {
      case 'up':
        offsetY = -ATTACK_RANGE;
        break;
      case 'down':
        offsetY = ATTACK_RANGE;
        break;
      case 'left':
        offsetX = -ATTACK_RANGE;
        break;
      case 'right':
        offsetX = ATTACK_RANGE;
        break;
    }

    const zone = this.scene.add.zone(
      this.player.x + offsetX,
      this.player.y + offsetY,
      TILE_SIZE,
      TILE_SIZE
    );
    this.scene.physics.add.existing(zone, false);

    EventBus.emit(Events.PLAYER_ATTACK, { direction });

    this.scene.time.delayedCall(100, () => {
      zone.destroy();
    });

    return zone;
  }

  isOnCooldown(): boolean {
    return this.scene.time.now - this.lastAttackTime < ATTACK_COOLDOWN_MS;
  }

  setMaxHealth(maxHealth: number): void {
    const healthPercent = this.currentHealth / this.maxHealth;
    this.maxHealth = maxHealth;
    this.currentHealth = Math.round(maxHealth * healthPercent);
  }

  getAttackDamage(inventory: Inventory, bonusDamage = 0): number {
    const weaponId = inventory.getEquipped('weapon');
    if (!weaponId) return 1 + bonusDamage;
    const def = ITEMS[weaponId];
    return (def?.stats?.damage ?? 1) + bonusDamage;
  }

  getDefense(inventory: Inventory): number {
    const accessoryId = inventory.getEquipped('accessory');
    if (!accessoryId) return 0;
    const def = ITEMS[accessoryId];
    return def?.stats?.defense ?? 0;
  }

  handlePlayerDamage(damage: number, knockbackFrom: { x: number; y: number }, inventory?: Inventory): void {
    if (this.inIFrames) return;
    if (this.currentHealth <= 0) return;

    let finalDamage = damage;
    if (inventory) {
      const defense = this.getDefense(inventory);
      finalDamage = Math.max(1, damage - defense);
    }

    this.currentHealth = Math.max(0, this.currentHealth - finalDamage);
    this.inIFrames = true;

    this.player.setTint(0xff0000);
    this.scene.cameras.main.shake(120, 0.006);

    const dx = this.player.x - knockbackFrom.x;
    const dy = this.player.y - knockbackFrom.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const knockbackForce = 200;
    this.player.setVelocity(
      (dx / dist) * knockbackForce,
      (dy / dist) * knockbackForce
    );
    this.knockbackTimer = 200;

    EventBus.emit(Events.ENTITY_DAMAGED, {
      entity: 'player',
      damage: finalDamage,
      currentHealth: this.currentHealth,
      maxHealth: this.maxHealth,
    });

    this.scene.time.delayedCall(INVINCIBILITY_MS, () => {
      this.inIFrames = false;
      this.player.clearTint();
    });

    if (this.currentHealth <= 0) {
      EventBus.emit(Events.PLAYER_DIED);
    }
  }

  update(delta: number): void {
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= delta;
    }
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= delta;
    }
    if (this.dashTimer > 0) {
      this.dashTimer -= delta;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.inIFrames = false;
        this.player.clearTint();
      }
    }
  }

  dash(facingDirection: string): boolean {
    if (this.isDashing || this.dashCooldownTimer > 0 || this.knockbackTimer > 0) return false;

    this.isDashing = true;
    this.dashTimer = DASH_DURATION_MS;
    this.dashCooldownTimer = DASH_DURATION_MS + DASH_COOLDOWN_MS;
    this.inIFrames = true;

    let dx = 0;
    let dy = 0;
    switch (facingDirection) {
      case 'up': dy = -1; break;
      case 'down': dy = 1; break;
      case 'left': dx = -1; break;
      case 'right': dx = 1; break;
    }

    const dashSpeed = PLAYER_SPEED * DASH_SPEED_MULTIPLIER;
    this.player.setVelocity(dx * dashSpeed, dy * dashSpeed);

    this.scene.tweens.add({
      targets: this.player,
      alpha: { from: 0.3, to: 1 },
      duration: 60,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.player.setAlpha(1);
      },
    });

    return true;
  }

  isDashActive(): boolean {
    return this.isDashing;
  }

  isKnockedBack(): boolean {
    return this.knockbackTimer > 0;
  }

  getHealth(): number {
    return this.currentHealth;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  isAlive(): boolean {
    return this.currentHealth > 0;
  }

  restoreHealth(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  resetHealth(): void {
    this.currentHealth = this.maxHealth;
    this.inIFrames = false;
    this.player.clearTint();
  }

  useConsumable(itemId: string, inventory: Inventory): boolean {
    const healAmount = CONSUMABLE_HEAL[itemId];
    if (!healAmount) return false;
    if (this.currentHealth >= this.maxHealth) return false;
    if (!inventory.hasItem(itemId)) return false;

    inventory.removeItem(itemId, 1);

    EventBus.emit(Events.ITEM_USED, { itemId, healAmount });

    if (itemId === 'provisions') {
      // Heal 4 HP every 500ms, 5 ticks = 20 total
      this.scene.time.addEvent({
        delay: 500,
        repeat: 4,
        callback: () => {
          this.restoreHealth(4);
          EventBus.emit(Events.ENTITY_DAMAGED, {
            entity: 'player',
            damage: 0,
            currentHealth: this.currentHealth,
            maxHealth: this.maxHealth,
          });
        },
      });
    } else {
      this.restoreHealth(healAmount);
      EventBus.emit(Events.ENTITY_DAMAGED, {
        entity: 'player',
        damage: 0,
        currentHealth: this.currentHealth,
        maxHealth: this.maxHealth,
      });
    }

    return true;
  }
}
