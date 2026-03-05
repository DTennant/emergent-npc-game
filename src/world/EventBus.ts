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

  // UI events
  SHOW_NOTIFICATION: 'ui:notification',
  UPDATE_HUD: 'ui:update_hud',
} as const;
