export interface NPCPersona {
  id: string;
  name: string;
  role: string;
  age: number;
  color: number;
  personality: string;
  speechStyle: string;
  backstory: string;
  values: string[];
  fears: string[];
  startingGoals: string[];
  homePosition: { x: number; y: number };
  workPosition: { x: number; y: number };
  schedule: Record<string, string>; // hour -> activity
  initialRelationships: Record<string, { trust: number; affection: number; notes: string[] }>;
}

export const NPC_PERSONAS: NPCPersona[] = [
  {
    id: 'blacksmith_erik',
    name: 'Erik',
    role: 'Blacksmith',
    age: 45,
    color: 0xcc4400,
    personality: 'Low openness, high conscientiousness, low extraversion, moderate agreeableness. Stoic and reliable.',
    speechStyle: 'Blunt and direct. Uses metalworking metaphors. Few words, but they carry weight.',
    backstory: 'Third-generation blacksmith. Lost his wife to illness five years ago. Pours himself into his work as a way to cope.',
    values: ['craftsmanship', 'honesty', 'tradition'],
    fears: ['losing his forge', 'being unable to provide'],
    startingGoals: ['Master the art of weapon forging', 'Find rare materials for a masterwork blade'],
    homePosition: { x: 200, y: 150 },
    workPosition: { x: 250, y: 200 },
    schedule: {
      '7': 'walk_to_work', '8': 'work', '12': 'lunch', '13': 'work',
      '17': 'organize', '18': 'walk_to_inn', '19': 'dinner', '21': 'walk_home', '22': 'sleep',
    },
    initialRelationships: {
      merchant_anna: { trust: 0.7, affection: 0.4, notes: ['Regular customer, reliable payments'] },
      innkeeper_rose: { trust: 0.8, affection: 0.6, notes: ['Old friend, she checks on him'] },
    },
  },
  {
    id: 'innkeeper_rose',
    name: 'Rose',
    role: 'Innkeeper',
    age: 38,
    color: 0xdd6699,
    personality: 'High openness, moderate conscientiousness, high extraversion, high agreeableness. Warm and perceptive.',
    speechStyle: 'Warm and chatty. Asks questions. Remembers little details about people.',
    backstory: 'Inherited the Thornwick Inn from her parents. Knows everyone and everything happening in the village. Unofficial counselor.',
    values: ['community', 'kindness', 'stories'],
    fears: ['loneliness', 'the village declining'],
    startingGoals: ['Keep the inn welcoming and profitable', 'Learn about the old legends from books'],
    homePosition: { x: 450, y: 200 },
    workPosition: { x: 450, y: 200 },
    schedule: {
      '6': 'prepare_inn', '8': 'work', '12': 'cook', '13': 'work',
      '18': 'serve_dinner', '22': 'clean_up', '23': 'sleep',
    },
    initialRelationships: {
      blacksmith_erik: { trust: 0.8, affection: 0.6, notes: ['Worries about him since his wife passed'] },
      farmer_thomas: { trust: 0.7, affection: 0.5, notes: ['Buys produce for the inn'] },
    },
  },
  {
    id: 'merchant_anna',
    name: 'Anna',
    role: 'Merchant',
    age: 32,
    color: 0x9944cc,
    personality: 'High openness, high conscientiousness, moderate extraversion, low agreeableness. Sharp and ambitious.',
    speechStyle: 'Quick-witted, always calculating. Compliments are usually sales tactics.',
    backstory: 'Came from the city three years ago. Runs the general store and manages trade caravans. Shrewd but fair.',
    values: ['profit', 'efficiency', 'independence'],
    fears: ['poverty', 'being trapped in a small village forever'],
    startingGoals: ['Establish trade routes to distant towns', 'Accumulate enough gold to expand the shop'],
    homePosition: { x: 350, y: 350 },
    workPosition: { x: 380, y: 300 },
    schedule: {
      '7': 'inventory', '8': 'open_shop', '12': 'lunch', '13': 'work',
      '16': 'check_deliveries', '18': 'close_shop', '19': 'walk_to_inn', '21': 'walk_home',
    },
    initialRelationships: {
      blacksmith_erik: { trust: 0.7, affection: 0.3, notes: ['Good supplier, fair prices'] },
      herbalist_willow: { trust: 0.6, affection: 0.4, notes: ['Supplies herbs, a bit eccentric'] },
    },
  },
  {
    id: 'farmer_thomas',
    name: 'Thomas',
    role: 'Farmer',
    age: 52,
    color: 0x558833,
    personality: 'Low openness, high conscientiousness, low extraversion, high agreeableness. Salt of the earth.',
    speechStyle: 'Slow and thoughtful. Weather metaphors. Speaks of the land like an old friend.',
    backstory: 'Worked the same fields his whole life. Wife and two grown children who moved to the city. Content but lonely.',
    values: ['hard work', 'nature', 'family'],
    fears: ['bad harvest', 'dying alone'],
    startingGoals: ['Produce enough food for the village', 'Protect crops from the spreading darkness'],
    homePosition: { x: 600, y: 400 },
    workPosition: { x: 650, y: 450 },
    schedule: {
      '5': 'wake_up', '6': 'farm_work', '12': 'lunch', '13': 'farm_work',
      '17': 'tend_animals', '18': 'walk_to_inn', '19': 'dinner', '20': 'walk_home', '21': 'sleep',
    },
    initialRelationships: {
      innkeeper_rose: { trust: 0.7, affection: 0.5, notes: ['Good customer'] },
      guard_marcus: { trust: 0.6, affection: 0.3, notes: ['Appreciates the safety he provides'] },
    },
  },
  {
    id: 'guard_marcus',
    name: 'Marcus',
    role: 'Guard Captain',
    age: 40,
    color: 0x667788,
    personality: 'Moderate openness, very high conscientiousness, moderate extraversion, low agreeableness. Strict but fair.',
    speechStyle: 'Military precision. Short sentences. Assesses everyone. Rarely jokes.',
    backstory: 'Former soldier who settled in Thornwick after being wounded. Takes village security very seriously. Haunted by things he saw in the war.',
    values: ['duty', 'order', 'protection'],
    fears: ['failing to protect the village', 'his past catching up'],
    startingGoals: ['Keep Thornwick safe from all threats', 'Investigate the darkness in the forest'],
    homePosition: { x: 150, y: 400 },
    workPosition: { x: 100, y: 350 },
    schedule: {
      '6': 'patrol', '9': 'guard_post', '12': 'lunch', '13': 'patrol',
      '16': 'guard_post', '19': 'walk_to_inn', '20': 'dinner', '21': 'patrol', '23': 'sleep',
    },
    initialRelationships: {
      innkeeper_rose: { trust: 0.6, affection: 0.4, notes: ['Good source of village gossip'] },
      farmer_thomas: { trust: 0.7, affection: 0.3, notes: ['Reliable citizen, reports wolf sightings'] },
    },
  },
  {
    id: 'herbalist_willow',
    name: 'Willow',
    role: 'Herbalist',
    age: 28,
    color: 0x33aa66,
    personality: 'Very high openness, low conscientiousness, low extraversion, high agreeableness. Dreamy and kind.',
    speechStyle: 'Soft-spoken, poetic. References plants and nature constantly. Sometimes talks to her herbs.',
    backstory: 'Orphan raised by the village. Self-taught herbalist who forages in the forest. Knows more about the woods than anyone.',
    values: ['nature', 'healing', 'freedom'],
    fears: ['the forest being cut down', 'being forced to leave'],
    startingGoals: ['Discover new herbal remedies', 'Protect the forest from the Blight'],
    homePosition: { x: 550, y: 150 },
    workPosition: { x: 500, y: 100 },
    schedule: {
      '6': 'forage', '9': 'tend_garden', '11': 'work', '13': 'forage',
      '16': 'work', '18': 'tend_garden', '20': 'walk_home', '21': 'sleep',
    },
    initialRelationships: {
      merchant_anna: { trust: 0.6, affection: 0.4, notes: ['Sells herbs through her shop'] },
      innkeeper_rose: { trust: 0.7, affection: 0.6, notes: ['Like a big sister figure'] },
    },
  },
];
