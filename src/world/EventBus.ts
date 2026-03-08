import Phaser from 'phaser';

// Global event bus for cross-system communication
export const EventBus = new Phaser.Events.EventEmitter();

// Event constants
export const Events = {
  // Player events
  PLAYER_INTERACT: 'player:interact',
  PLAYER_MOVE: 'player:move',

  // NPC events
  NPC_SPEAK: 'npc:speak',
  NPC_MOOD_CHANGE: 'npc:mood_change',
  NPC_GOSSIP: 'npc:gossip',

  // Dialogue events
  DIALOGUE_START: 'dialogue:start',
  DIALOGUE_END: 'dialogue:end',
  DIALOGUE_RESPONSE: 'dialogue:response',

  // World events
  TIME_TICK: 'world:time_tick',
  DAY_CHANGE: 'world:day_change',
  RESOURCE_CHANGE: 'world:resource_change',

  // Memory events
  MEMORY_FORMED: 'memory:formed',
  MEMORY_RECALLED: 'memory:recalled',

  // Inventory events
  INVENTORY_CHANGE: 'inventory:change',
  ITEM_ACQUIRED: 'inventory:item_acquired',
  ITEM_USED: 'inventory:item_used',

  // Village events
  VILLAGE_EVENT: 'village:event',

  // Combat events
  PLAYER_ATTACK: 'combat:player_attack',
  ENTITY_DAMAGED: 'combat:entity_damaged',
  ENTITY_DIED: 'combat:entity_died',
  PLAYER_DIED: 'combat:player_died',

  // Quest events
  QUEST_PROGRESS: 'quest:progress',
  RUNESTONE_OBTAINED: 'quest:runestone_obtained',
  SHRINE_ACTIVATED: 'quest:shrine_activated',

  // Crafting events
  ITEM_CRAFTED: 'craft:item_crafted',

  // Trade events
  TRADE_COMPLETE: 'trade:complete',

  // UI events
  SHOW_NOTIFICATION: 'ui:notification',
  UPDATE_HUD: 'ui:update_hud',
  SETTINGS_OPEN: 'ui:settings_open',
  SETTINGS_CLOSE: 'ui:settings_close',

  // Building events
  BUILDING_ENTER: 'building:enter',
  BUILDING_EXIT: 'building:exit',

  // LLM events
  LLM_CONFIG_CHANGED: 'llm:config_changed',
} as const;
