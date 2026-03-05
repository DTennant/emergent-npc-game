export interface ItemDef {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'tool' | 'consumable' | 'quest' | 'material';
  equipSlot?: 'weapon' | 'lantern' | 'accessory';
  stats?: { damage?: number; defense?: number };
  stackable: boolean;
  maxStack: number;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export const ITEMS: Record<string, ItemDef> = {
  wooden_sword: {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    description: 'A simple wooden training sword. Better than nothing.',
    type: 'weapon',
    equipSlot: 'weapon',
    stats: { damage: 5 },
    stackable: false,
    maxStack: 1,
  },
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy iron blade forged by Erik.',
    type: 'weapon',
    equipSlot: 'weapon',
    stats: { damage: 12 },
    stackable: false,
    maxStack: 1,
  },
  enchanted_blade: {
    id: 'enchanted_blade',
    name: 'Enchanted Blade',
    description: 'A blade imbued with arcane energy. Glows faintly in the dark.',
    type: 'weapon',
    equipSlot: 'weapon',
    stats: { damage: 20 },
    stackable: false,
    maxStack: 1,
  },
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    description: 'An old brass lantern. Essential for dark places.',
    type: 'tool',
    equipSlot: 'lantern',
    stackable: false,
    maxStack: 1,
  },
  rope: {
    id: 'rope',
    name: 'Rope',
    description: 'A sturdy length of rope. Useful for climbing and descending.',
    type: 'tool',
    stackable: false,
    maxStack: 1,
  },
  herb_pouch: {
    id: 'herb_pouch',
    name: 'Herb Pouch',
    description: 'A leather pouch for collecting and storing herbs.',
    type: 'tool',
    stackable: false,
    maxStack: 1,
  },
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'A restorative brew made from forest herbs. Heals minor wounds.',
    type: 'consumable',
    stackable: true,
    maxStack: 10,
  },
  raw_iron: {
    id: 'raw_iron',
    name: 'Raw Iron',
    description: 'Unrefined iron ore. Erik can forge this into something useful.',
    type: 'material',
    stackable: true,
    maxStack: 20,
  },
  moonpetal: {
    id: 'moonpetal',
    name: 'Moonpetal',
    description: 'A rare flower that blooms only under moonlight. Willow needs these.',
    type: 'material',
    stackable: true,
    maxStack: 10,
  },
  enchantment_dust: {
    id: 'enchantment_dust',
    name: 'Enchantment Dust',
    description: 'Shimmering arcane powder. Used to imbue weapons with magic.',
    type: 'material',
    stackable: true,
    maxStack: 5,
  },
  runestone_forest: {
    id: 'runestone_forest',
    name: 'Forest Runestone',
    description: 'An ancient runestone recovered from the Forest Cave. Pulses with green light.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  runestone_mine: {
    id: 'runestone_mine',
    name: 'Mine Runestone',
    description: 'An ancient runestone recovered from the Abandoned Mine. Glows with amber warmth.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  runestone_tower: {
    id: 'runestone_tower',
    name: 'Tower Runestone',
    description: 'An ancient runestone recovered from the Ruined Tower. Crackles with violet energy.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  aldric_journal_1: {
    id: 'aldric_journal_1',
    name: "Aldric's Journal (Part 1)",
    description: 'The first pages of Sage Aldric\'s journal. Mentions the Blight\'s origins.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  aldric_journal_2: {
    id: 'aldric_journal_2',
    name: "Aldric's Journal (Part 2)",
    description: 'Journal entries about the Shrine of Dawn and its protective wards.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  aldric_journal_3: {
    id: 'aldric_journal_3',
    name: "Aldric's Journal (Part 3)",
    description: 'Notes on the three runestone locations and their guardians.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  aldric_journal_4: {
    id: 'aldric_journal_4',
    name: "Aldric's Journal (Part 4)",
    description: 'Aldric\'s research on the enchantments needed to combat the Blight.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  aldric_journal_5: {
    id: 'aldric_journal_5',
    name: "Aldric's Journal (Part 5)",
    description: 'The final entry. Aldric writes of his departure into the Ancient Forest.',
    type: 'quest',
    stackable: false,
    maxStack: 1,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    description: 'The common currency of Thornwick and the surrounding lands.',
    type: 'material',
    stackable: true,
    maxStack: 999,
  },
};
