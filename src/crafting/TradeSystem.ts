import { Inventory } from '../inventory/Inventory';
import { ITEMS, ItemDef } from '../inventory/types';
import { NPCShop, ShopItem } from './TradeData';
import { EventBus, Events } from '../world/EventBus';

export interface TradeItem {
  itemId: string;
  def: ItemDef;
  price: number;
  stock: number;
  locked: boolean;
  lockReason?: string;
}

export class TradeSystem {
  getBuyList(shop: NPCShop, trust: number): TradeItem[] {
    const results: TradeItem[] = [];
    for (const si of shop.sells) {
      const def = ITEMS[si.itemId];
      if (!def) continue;

      const basePrice = def.value ?? 10;
      const discount = trust * shop.trustDiscount;
      const price = Math.max(1, Math.round(basePrice * (1 - discount)));

      const locked = si.requiresTrust !== undefined && trust < si.requiresTrust;
      const lockReason = locked
        ? `Requires trust ${Math.round((si.requiresTrust ?? 0) * 100)}%`
        : undefined;

      results.push({ itemId: si.itemId, def, price, stock: si.stock, locked, lockReason });
    }
    return results;
  }

  getSellList(shop: NPCShop, inventory: Inventory, trust: number): TradeItem[] {
    const items = inventory.getItems();
    const results: TradeItem[] = [];

    for (const slot of items) {
      const def = ITEMS[slot.itemId];
      if (!def) continue;
      if (def.type === 'quest') continue;
      if (def.id === 'gold') continue;
      if (!shop.buysTypes.includes(def.type as typeof shop.buysTypes[number])) continue;

      const basePrice = def.value ?? 10;
      const bonus = trust * shop.trustDiscount;
      const price = Math.max(1, Math.round(basePrice * (shop.buyPriceMultiplier + bonus)));

      results.push({
        itemId: slot.itemId,
        def,
        price,
        stock: slot.quantity,
        locked: false,
      });
    }

    return results;
  }

  buyItem(
    shop: NPCShop,
    itemId: string,
    quantity: number,
    inventory: Inventory,
    trust: number
  ): boolean {
    const buyList = this.getBuyList(shop, trust);
    const item = buyList.find((i) => i.itemId === itemId);
    if (!item || item.locked) return false;
    if (quantity > item.stock) return false;

    const totalCost = item.price * quantity;
    if (!inventory.hasItem('gold', totalCost)) return false;

    inventory.removeItem('gold', totalCost);
    const added = inventory.addItem(itemId, quantity);
    if (!added) {
      inventory.addItem('gold', totalCost);
      return false;
    }

    EventBus.emit(Events.TRADE_COMPLETE, {
      type: 'buy',
      npcId: shop.npcId,
      itemId,
      quantity,
      gold: totalCost,
    });
    return true;
  }

  sellItem(
    shop: NPCShop,
    itemId: string,
    quantity: number,
    inventory: Inventory,
    trust: number
  ): boolean {
    const sellList = this.getSellList(shop, inventory, trust);
    const item = sellList.find((i) => i.itemId === itemId);
    if (!item) return false;
    if (quantity > item.stock) return false;

    const totalValue = item.price * quantity;
    inventory.removeItem(itemId, quantity);
    inventory.addItem('gold', totalValue);

    EventBus.emit(Events.TRADE_COMPLETE, {
      type: 'sell',
      npcId: shop.npcId,
      itemId,
      quantity,
      gold: totalValue,
    });
    return true;
  }
}
