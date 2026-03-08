export interface ShopItem {
  itemId: string;
  stock: number;
  requiresTrust?: number;
}

export interface NPCShop {
  npcId: string;
  shopName: string;
  sells: ShopItem[];
  buysTypes: ('weapon' | 'tool' | 'consumable' | 'material' | 'armor')[];
  buyPriceMultiplier: number;
  trustDiscount: number;
}

export const NPC_SHOPS: Record<string, NPCShop> = {
  merchant_anna: {
    npcId: 'merchant_anna',
    shopName: "Anna's General Store",
    sells: [
      { itemId: 'glass_vial', stock: 10 },
      { itemId: 'rope', stock: 3 },
      { itemId: 'lantern', stock: 2 },
      { itemId: 'health_potion', stock: 5 },
      { itemId: 'wood', stock: 20 },
      { itemId: 'stone', stock: 20 },
      { itemId: 'moonpetal', stock: 3, requiresTrust: 0.5 },
      { itemId: 'enchantment_dust', stock: 4, requiresTrust: 0.6 },
    ],
    buysTypes: ['weapon', 'tool', 'consumable', 'material', 'armor'],
    buyPriceMultiplier: 0.5,
    trustDiscount: 0.1,
  },
  blacksmith_erik: {
    npcId: 'blacksmith_erik',
    shopName: "Erik's Forge",
    sells: [
      { itemId: 'iron_sword', stock: 2, requiresTrust: 0.4 },
      { itemId: 'iron_shield', stock: 1, requiresTrust: 0.5 },
      { itemId: 'raw_iron', stock: 10 },
      { itemId: 'stone_axe', stock: 3 },
      { itemId: 'leather', stock: 5 },
    ],
    buysTypes: ['weapon', 'material'],
    buyPriceMultiplier: 0.6,
    trustDiscount: 0.15,
  },
  herbalist_willow: {
    npcId: 'herbalist_willow',
    shopName: "Willow's Apothecary",
    sells: [
      { itemId: 'health_potion', stock: 5 },
      { itemId: 'blight_ward', stock: 3, requiresTrust: 0.5 },
      { itemId: 'moonpetal', stock: 5 },
      { itemId: 'glass_vial', stock: 5 },
      { itemId: 'herb_pouch', stock: 2 },
    ],
    buysTypes: ['material', 'consumable'],
    buyPriceMultiplier: 0.5,
    trustDiscount: 0.1,
  },
  innkeeper_rose: {
    npcId: 'innkeeper_rose',
    shopName: "Rose's Inn",
    sells: [
      { itemId: 'provisions', stock: 10 },
      { itemId: 'health_potion', stock: 3 },
    ],
    buysTypes: ['material', 'consumable'],
    buyPriceMultiplier: 0.4,
    trustDiscount: 0.1,
  },
  guard_marcus: {
    npcId: 'guard_marcus',
    shopName: "Marcus's Armory",
    sells: [
      { itemId: 'provisions', stock: 8 },
      { itemId: 'iron_shield', stock: 1, requiresTrust: 0.7 },
    ],
    buysTypes: ['weapon', 'material'],
    buyPriceMultiplier: 0.5,
    trustDiscount: 0.1,
  },
  farmer_thomas: {
    npcId: 'farmer_thomas',
    shopName: "Thomas's Farm Stand",
    sells: [
      { itemId: 'provisions', stock: 15 },
      { itemId: 'wood', stock: 20 },
      { itemId: 'plant_fiber', stock: 15 },
    ],
    buysTypes: ['material'],
    buyPriceMultiplier: 0.4,
    trustDiscount: 0.05,
  },
};
