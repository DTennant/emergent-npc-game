extends Node
## WorldState - Global game state singleton.
## Tracks time, resources, weather, village mood, and known threats.

# Time
var day: int = 1
var hour: float = 8.0
var minute: float = 0.0
var season: String = "spring"
var time_scale: float = 60.0  # 1 real second = 60 game seconds

# Weather
var weather: String = "clear"
var weather_options = ["clear", "cloudy", "rain", "storm", "fog"]

# Resources (village-level)
var resources: Dictionary = {
	"wheat": 100,
	"ore": 50,
	"wood": 80,
	"bread": 30,
	"ale": 20,
}

# Village state
var village_mood: float = 0.6  # 0.0 (despair) to 1.0 (thriving)
var known_threats: Array = []
var village_events_log: Array = []

# NPC registry
var registered_npcs: Dictionary = {}  # npc_id -> node reference

func _process(delta: float) -> void:
	_advance_time(delta)

func _advance_time(delta: float) -> void:
	var game_seconds = delta * time_scale
	minute += game_seconds / 60.0
	
	if minute >= 60.0:
		minute -= 60.0
		var old_hour = int(hour)
		hour += 1.0
		
		if int(hour) != old_hour:
			EventBus.time_changed.emit(int(hour), day, season)
		
		if hour >= 24.0:
			hour -= 24.0
			day += 1
			_check_season()
			EventBus.day_ended.emit(day)

func _check_season() -> void:
	var old_season = season
	var day_in_year = day % 120  # 120-day year (30 per season)
	if day_in_year < 30:
		season = "spring"
	elif day_in_year < 60:
		season = "summer"
	elif day_in_year < 90:
		season = "autumn"
	else:
		season = "winter"
	
	if season != old_season:
		EventBus.world_event.emit("season_change", {"new_season": season, "old_season": old_season})

func get_time_of_day() -> String:
	var h = int(hour)
	if h < 6: return "night"
	if h < 8: return "dawn"
	if h < 12: return "morning"
	if h < 14: return "midday"
	if h < 18: return "afternoon"
	if h < 21: return "evening"
	return "night"

func get_world_context() -> Dictionary:
	return {
		"day": day,
		"hour": int(hour),
		"time_of_day": get_time_of_day(),
		"season": season,
		"weather": weather,
		"village_mood": village_mood,
		"threats": known_threats,
		"resources": resources.duplicate(),
	}

func register_npc(npc_id: String, npc_node: Node) -> void:
	registered_npcs[npc_id] = npc_node

func unregister_npc(npc_id: String) -> void:
	registered_npcs.erase(npc_id)

func get_npc(npc_id: String) -> Node:
	return registered_npcs.get(npc_id)

func get_all_npcs() -> Dictionary:
	return registered_npcs

func modify_resource(resource: String, amount: int) -> void:
	var old = resources.get(resource, 0)
	resources[resource] = max(0, old + amount)
	EventBus.resource_changed.emit(resource, old, resources[resource])

func log_event(event: Dictionary) -> void:
	event["day"] = day
	event["hour"] = int(hour)
	village_events_log.append(event)
	# Keep last 100 events
	if village_events_log.size() > 100:
		village_events_log = village_events_log.slice(-100)

func save_state() -> Dictionary:
	return {
		"day": day,
		"hour": hour,
		"season": season,
		"weather": weather,
		"resources": resources.duplicate(),
		"village_mood": village_mood,
		"known_threats": known_threats.duplicate(),
		"events_log": village_events_log.duplicate(),
	}

func load_state(data: Dictionary) -> void:
	day = data.get("day", 1)
	hour = data.get("hour", 8.0)
	season = data.get("season", "spring")
	weather = data.get("weather", "clear")
	resources = data.get("resources", resources)
	village_mood = data.get("village_mood", 0.6)
	known_threats = data.get("known_threats", [])
	village_events_log = data.get("events_log", [])
