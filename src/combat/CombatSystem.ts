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

  getAttackDamage(inventory: Inventory): number {
    const weaponId = inventory.getEquipped('weapon');
    if (!weaponId) return 1;
    const def = ITEMS[weaponId];
    return def?.stats?.damage ?? 1;
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

    const dx = this.player.x - knockbackFrom.x;
    const dy = this.player.y - knockbackFrom.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const knockbackForce = 200;
    this.player.setVelocity(
      (dx / dist) * knockbackForce,
      (dy / dist) * knockbackForce
    );

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
    this.restoreHealth(healAmount);

    EventBus.emit(Events.ITEM_USED, { itemId, healAmount });
    EventBus.emit(Events.ENTITY_DAMAGED, {
      entity: 'player',
      damage: 0,
      currentHealth: this.currentHealth,
      maxHealth: this.maxHealth,
    });

    return true;
  }
}
