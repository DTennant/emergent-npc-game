import { InventorySlot, ITEMS } from './types';
import { EventBus, Events } from '../world/EventBus';

const MAX_SLOTS = 20;
const EQUIP_SLOTS = ['weapon', 'lantern', 'accessory'] as const;

interface InventoryJSON {
  items: InventorySlot[];
  equipped: Record<string, string | null>;
}

export class Inventory {
  private items: InventorySlot[] = [];
  private equipped: Record<string, string | null> = {
    weapon: null,
    lantern: null,
    accessory: null,
  };

  addItem(itemId: string, quantity = 1): boolean {
    const def = ITEMS[itemId];
    if (!def) return false;

    if (def.stackable) {
      const existing = this.items.find((slot) => slot.itemId === itemId);
      if (existing) {
        const canAdd = Math.min(quantity, def.maxStack - existing.quantity);
        if (canAdd <= 0) return false;
        existing.quantity += canAdd;
        this.emitChange();
        EventBus.emit(Events.ITEM_ACQUIRED, { itemId, quantity: canAdd });
        return true;
      }
    }

    if (this.items.length >= MAX_SLOTS) return false;

    const qty = def.stackable ? Math.min(quantity, def.maxStack) : 1;
    this.items.push({ itemId, quantity: qty });
    this.emitChange();
    EventBus.emit(Events.ITEM_ACQUIRED, { itemId, quantity: qty });
    return true;
  }

  removeItem(itemId: string, quantity = 1): boolean {
    const index = this.items.findIndex((slot) => slot.itemId === itemId);
    if (index === -1) return false;

    const slot = this.items[index];
    if (slot.quantity < quantity) return false;

    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      this.items.splice(index, 1);
      for (const equipSlot of EQUIP_SLOTS) {
        if (this.equipped[equipSlot] === itemId) {
          this.equipped[equipSlot] = null;
        }
      }
    }

    this.emitChange();
    return true;
  }

  hasItem(itemId: string, minQuantity = 1): boolean {
    const slot = this.items.find((s) => s.itemId === itemId);
    return slot !== undefined && slot.quantity >= minQuantity;
  }

  getItemCount(itemId: string): number {
    const slot = this.items.find((s) => s.itemId === itemId);
    return slot ? slot.quantity : 0;
  }

  equip(itemId: string): boolean {
    const def = ITEMS[itemId];
    if (!def || !def.equipSlot) return false;
    if (!this.hasItem(itemId)) return false;

    this.equipped[def.equipSlot] = itemId;
    this.emitChange();
    return true;
  }

  unequip(slot: string): boolean {
    if (!this.equipped[slot]) return false;
    this.equipped[slot] = null;
    this.emitChange();
    return true;
  }

  getEquipped(slot: string): string | null {
    return this.equipped[slot] ?? null;
  }

  getItems(): ReadonlyArray<InventorySlot> {
    return this.items;
  }

  getEquippedSlots(): Readonly<Record<string, string | null>> {
    return this.equipped;
  }

  toJSON(): InventoryJSON {
    return {
      items: this.items.map((s) => ({ ...s })),
      equipped: { ...this.equipped },
    };
  }

  fromJSON(data: InventoryJSON): void {
    this.items = data.items.map((s) => ({ ...s }));
    this.equipped = { ...data.equipped };
    this.emitChange();
  }

  private emitChange(): void {
    EventBus.emit(Events.INVENTORY_CHANGE, {
      items: this.items,
      equipped: this.equipped,
    });
  }
}
