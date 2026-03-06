export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  result: { itemId: string; quantity: number };
  ingredients: RecipeIngredient[];
  requiresBench: boolean;
  unlockedByNPC?: string;
  requiredTrust?: number;
  description: string;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craft_rope',
    name: 'Rope',
    result: { itemId: 'rope', quantity: 1 },
    ingredients: [{ itemId: 'plant_fiber', quantity: 5 }],
    requiresBench: false,
    description: 'Braid plant fibers into sturdy rope.',
  },
  {
    id: 'craft_wooden_sword',
    name: 'Wooden Sword',
    result: { itemId: 'wooden_sword', quantity: 1 },
    ingredients: [{ itemId: 'wood', quantity: 3 }],
    requiresBench: false,
    description: 'Whittle a basic training sword from wood.',
  },
  {
    id: 'craft_stone_axe',
    name: 'Stone Axe',
    result: { itemId: 'stone_axe', quantity: 1 },
    ingredients: [
      { itemId: 'stone', quantity: 3 },
      { itemId: 'wood', quantity: 2 },
    ],
    requiresBench: false,
    description: 'Bind stone to a wooden handle.',
  },
  {
    id: 'craft_herb_pouch',
    name: 'Herb Pouch',
    result: { itemId: 'herb_pouch', quantity: 1 },
    ingredients: [{ itemId: 'leather', quantity: 2 }],
    requiresBench: false,
    description: 'Sew leather into a pouch for herbs.',
  },
  {
    id: 'craft_leather',
    name: 'Leather',
    result: { itemId: 'leather', quantity: 1 },
    ingredients: [{ itemId: 'wolf_pelt', quantity: 1 }],
    requiresBench: false,
    description: 'Tan a wolf pelt into usable leather.',
  },
  {
    id: 'craft_leather_armor',
    name: 'Leather Armor',
    result: { itemId: 'leather_armor', quantity: 1 },
    ingredients: [
      { itemId: 'leather', quantity: 4 },
      { itemId: 'plant_fiber', quantity: 2 },
    ],
    requiresBench: true,
    description: 'Stitch leather pieces into protective armor.',
  },
  {
    id: 'craft_iron_sword',
    name: 'Iron Sword',
    result: { itemId: 'iron_sword', quantity: 1 },
    ingredients: [
      { itemId: 'raw_iron', quantity: 3 },
      { itemId: 'wood', quantity: 1 },
    ],
    requiresBench: true,
    unlockedByNPC: 'blacksmith_erik',
    requiredTrust: 0.6,
    description: 'Erik forges iron into a proper blade.',
  },
  {
    id: 'craft_iron_shield',
    name: 'Iron Shield',
    result: { itemId: 'iron_shield', quantity: 1 },
    ingredients: [
      { itemId: 'raw_iron', quantity: 4 },
      { itemId: 'leather', quantity: 1 },
    ],
    requiresBench: true,
    unlockedByNPC: 'blacksmith_erik',
    requiredTrust: 0.6,
    description: 'Erik hammers iron into a sturdy shield.',
  },
  {
    id: 'craft_lantern',
    name: 'Lantern',
    result: { itemId: 'lantern', quantity: 1 },
    ingredients: [
      { itemId: 'raw_iron', quantity: 2 },
      { itemId: 'glass_vial', quantity: 1 },
    ],
    requiresBench: true,
    description: 'Assemble a lantern from iron and glass.',
  },
  {
    id: 'craft_health_potion',
    name: 'Health Potion',
    result: { itemId: 'health_potion', quantity: 1 },
    ingredients: [
      { itemId: 'moonpetal', quantity: 2 },
      { itemId: 'glass_vial', quantity: 1 },
    ],
    requiresBench: true,
    unlockedByNPC: 'herbalist_willow',
    requiredTrust: 0.5,
    description: 'Willow taught you to brew healing draughts.',
  },
  {
    id: 'craft_blight_ward',
    name: 'Blight Ward',
    result: { itemId: 'blight_ward', quantity: 1 },
    ingredients: [
      { itemId: 'moonpetal', quantity: 1 },
      { itemId: 'enchantment_dust', quantity: 1 },
      { itemId: 'glass_vial', quantity: 1 },
    ],
    requiresBench: true,
    unlockedByNPC: 'herbalist_willow',
    requiredTrust: 0.5,
    description: 'A ward against the encroaching Blight.',
  },
  {
    id: 'craft_enchanted_blade',
    name: 'Enchanted Blade',
    result: { itemId: 'enchanted_blade', quantity: 1 },
    ingredients: [
      { itemId: 'iron_sword', quantity: 1 },
      { itemId: 'enchantment_dust', quantity: 2 },
    ],
    requiresBench: true,
    unlockedByNPC: 'blacksmith_erik',
    requiredTrust: 0.7,
    description: 'Erik imbues a blade with arcane energy.',
  },
  {
    id: 'craft_provisions',
    name: 'Provisions',
    result: { itemId: 'provisions', quantity: 3 },
    ingredients: [{ itemId: 'gold', quantity: 5 }],
    requiresBench: false,
    unlockedByNPC: 'farmer_thomas',
    requiredTrust: 0.4,
    description: 'Thomas prepares travel rations.',
  },
];
