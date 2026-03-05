extends Node
## EventBus - Central event system for the game.
## All inter-system communication goes through here.

# NPC Events
signal npc_spoke(npc_id: String, dialogue: String, mood: float)
signal npc_interaction(npc_id: String, interaction_type: String, details: Dictionary)
signal npc_mood_changed(npc_id: String, old_mood: float, new_mood: float)
signal npc_goal_changed(npc_id: String, old_goal: String, new_goal: String)

# Social Events
signal gossip_spread(from_npc: String, to_npc: String, info: Dictionary)
signal relationship_changed(npc_a: String, npc_b: String, dimension: String, delta: float)
signal reputation_updated(entity_id: String, npc_id: String, change: Dictionary)

# World Events
signal world_event(event_type: String, data: Dictionary)
signal time_changed(hour: int, day: int, season: String)
signal weather_changed(new_weather: String)

# Economy Events
signal economy_updated(item: String, old_price: float, new_price: float)
signal trade_occurred(buyer: String, seller: String, item: String, price: float)
signal resource_changed(resource: String, old_amount: int, new_amount: int)

# Quest Events
signal quest_generated(npc_id: String, quest_data: Dictionary)
signal quest_completed(quest_id: String, outcome: String)

# Player Events
signal player_entered_area(area_name: String)
signal player_near_npc(npc_id: String, distance: float)
signal player_left_npc(npc_id: String)

# Dialogue Events
signal dialogue_started(npc_id: String)
signal dialogue_ended(npc_id: String)
signal player_message_sent(npc_id: String, message: String)

# System Events
signal game_saved(slot: String)
signal game_loaded(slot: String)
signal day_ended(day: int)
