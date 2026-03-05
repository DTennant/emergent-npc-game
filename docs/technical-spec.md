# Technical Specification

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Game Engine | Godot 4.x | Open source, strong 2D, GDScript is Python-like |
| Language | GDScript + Python (AI backend) | GDScript for game logic, Python for LLM integration |
| AI Backend | LLM API via HTTP | Flexible model choice (OpenAI, local, LiteLLM) |
| Data Storage | JSON files | Simple, human-readable, easy debugging |
| Art Style | Pixel art (32x32 tiles) | Achievable scope, charming aesthetic |
| View | Top-down 2D | Classic RPG perspective |

## Godot Project Structure

```
godot/
├── project.godot
├── scenes/
│   ├── main.tscn                    # Main game scene
│   ├── world/
│   │   ├── village.tscn             # Village map
│   │   └── interior/
│   │       ├── forge.tscn           # Blacksmith interior
│   │       ├── inn.tscn             # Inn interior
│   │       └── shop.tscn            # Merchant shop
│   ├── entities/
│   │   ├── player.tscn              # Player character
│   │   └── npc.tscn                 # Base NPC scene
│   └── ui/
│       ├── dialogue_box.tscn        # Dialogue UI
│       ├── hud.tscn                 # Player HUD
│       └── inventory.tscn           # Inventory screen
├── scripts/
│   ├── npc/
│   │   ├── npc_controller.gd        # NPC behavior & movement
│   │   ├── npc_brain.gd             # Decision making
│   │   ├── memory_manager.gd        # Memory system
│   │   └── social_manager.gd        # Relationship tracking
│   ├── world/
│   │   ├── world_state.gd           # Global world state
│   │   ├── time_manager.gd          # Day/night, seasons
│   │   ├── event_bus.gd             # Event system (autoload)
│   │   └── economy_manager.gd       # Trade & resource tracking
│   ├── ai/
│   │   ├── llm_client.gd            # HTTP client for LLM API
│   │   ├── prompt_builder.gd        # Constructs LLM prompts
│   │   └── response_parser.gd       # Parses LLM JSON responses
│   ├── player/
│   │   ├── player_controller.gd     # Player movement & input
│   │   └── inventory.gd             # Player inventory
│   └── ui/
│       ├── dialogue_controller.gd   # Dialogue box logic
│       └── hud_controller.gd        # HUD updates
├── resources/
│   ├── npc_definitions/             # NPC persona JSON files
│   │   ├── blacksmith_erik.json
│   │   ├── innkeeper_rose.json
│   │   └── ...
│   └── items/                       # Item definitions
│       └── items.json
├── assets/
│   ├── sprites/
│   │   ├── characters/              # Character spritesheets
│   │   ├── tilesets/                 # Map tiles
│   │   └── ui/                      # UI elements
│   └── audio/
│       ├── music/
│       └── sfx/
└── save/                            # Save data (gitignored)
    ├── world_state.json
    └── npcs/
```

## Core Systems Implementation

### 1. Event Bus (Autoload Singleton)

Central nervous system of the game. All systems communicate through events.

```gdscript
# scripts/world/event_bus.gd
extends Node

signal npc_interaction(npc_id: String, player_action: String, details: Dictionary)
signal world_event(event_type: String, data: Dictionary)
signal gossip_spread(from_npc: String, to_npc: String, info: Dictionary)
signal quest_generated(npc_id: String, quest_data: Dictionary)
signal time_changed(hour: int, day: int, season: String)
signal economy_updated(item: String, price_change: float)
```

### 2. LLM Client

```gdscript
# scripts/ai/llm_client.gd
extends Node

const API_URL = "https://api.openai.com/v1/chat/completions"
var api_key: String
var http_request: HTTPRequest

func _ready():
    http_request = HTTPRequest.new()
    add_child(http_request)
    http_request.request_completed.connect(_on_request_completed)
    api_key = _load_api_key()

func generate_response(messages: Array, callback: Callable) -> void:
    var body = {
        "model": "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.8,
        "max_tokens": 500,
        "response_format": {"type": "json_object"}
    }
    var headers = [
        "Content-Type: application/json",
        "Authorization: Bearer " + api_key
    ]
    # Queue request with callback
    _queue_request(body, headers, callback)

func _load_api_key() -> String:
    # Load from environment or config file
    var key = OS.get_environment("OPENAI_API_KEY")
    if key.is_empty():
        var file = FileAccess.open("user://config/api_key.txt", FileAccess.READ)
        if file:
            key = file.get_as_text().strip_edges()
    return key
```

### 3. NPC Controller

```gdscript
# scripts/npc/npc_controller.gd
extends CharacterBody2D

@export var npc_id: String
@export var interaction_range: float = 64.0

var brain: NPCBrain
var memory: MemoryManager
var current_action: String = "idle"
var current_target: Vector2

func _ready():
    brain = NPCBrain.new(npc_id)
    memory = MemoryManager.new(npc_id)
    add_child(brain)
    add_child(memory)
    _load_persona()
    EventBus.time_changed.connect(_on_time_changed)

func _physics_process(delta):
    match current_action:
        "idle":
            _do_idle()
        "walk_to":
            _move_toward(current_target, delta)
        "work":
            _do_work()
        "talk":
            _face_speaker()

func interact_with_player(player_message: String) -> void:
    current_action = "talk"
    var context = memory.retrieve(player_message)
    brain.generate_dialogue(player_message, context, _on_dialogue_ready)

func _on_dialogue_ready(response: Dictionary) -> void:
    # Display dialogue
    DialogueController.show(npc_id, response.dialogue)
    # Store memory
    memory.store_episodic({
        "type": "player_interaction",
        "content": response.get("memory_to_store", ""),
        "emotional_valence": response.get("mood_change", 0),
    })
    # Resume behavior after dialogue
    current_action = "idle"

func _on_time_changed(hour: int, day: int, season: String) -> void:
    brain.update_schedule(hour)
```

### 4. World State

```gdscript
# scripts/world/world_state.gd
extends Node

var day: int = 1
var hour: float = 8.0
var season: String = "spring"
var weather: String = "clear"

var resources: Dictionary = {
    "wheat": 100,
    "ore": 50,
    "wood": 80,
}

var village_mood: float = 0.6  # 0-1
var known_threats: Array = []

func get_world_context() -> Dictionary:
    return {
        "day": day,
        "hour": int(hour),
        "time_of_day": _get_time_of_day(),
        "season": season,
        "weather": weather,
        "village_mood": village_mood,
        "threats": known_threats,
    }

func _get_time_of_day() -> String:
    if hour < 6: return "night"
    if hour < 8: return "dawn"
    if hour < 12: return "morning"
    if hour < 14: return "midday"
    if hour < 18: return "afternoon"
    if hour < 21: return "evening"
    return "night"
```

## LLM Integration Strategy

### Cost Management

| Interaction Type | Model | Est. Cost | Frequency |
|-----------------|-------|-----------|-----------|
| Player dialogue | gpt-4o-mini / gemini-flash | ~$0.001 | On demand |
| NPC daily planning | gpt-4o-mini | ~$0.0005 | Once/day per NPC |
| NPC gossip summary | gpt-4o-mini | ~$0.0003 | 2-3x/day per NPC |
| Memory consolidation | gpt-4o-mini | ~$0.001 | Once/day per NPC |
| **Total per play hour** | | **~$0.01-0.05** | |

### Latency Mitigation

1. **Pre-generation:** NPCs generate greetings and common responses during idle time
2. **Streaming:** Use SSE streaming for longer responses (player sees text appear)
3. **Async loading:** Show "NPC is thinking..." animation during API call
4. **Caching:** Cache responses for identical/similar queries within session
5. **Fallback:** Pre-written responses for when API is unavailable

### Model Selection

```gdscript
func _select_model(interaction_type: String) -> String:
    match interaction_type:
        "player_dialogue":
            return "gpt-4o-mini"  # Best quality for player-facing
        "npc_gossip":
            return "gpt-4o-mini"  # Good enough, cheaper
        "daily_planning":
            return "gpt-4o-mini"  # Structured output
        _:
            return "gpt-4o-mini"
```

## Save System

### Auto-save Triggers
- End of each in-game day
- After significant events
- When player exits

### Save Format
```json
{
  "version": "0.1.0",
  "timestamp": "2026-03-05T12:00:00Z",
  "world": {
    "day": 7,
    "season": "spring",
    "resources": {},
    "events_log": []
  },
  "player": {
    "position": [320, 240],
    "inventory": [],
    "stats": {}
  },
  "npcs": {
    "blacksmith_erik": {
      "position": [400, 300],
      "state": "working",
      "mood": 0.7,
      "memories": "npcs/blacksmith_erik/episodic_memory.json",
      "relationships": "npcs/blacksmith_erik/social_memory.json"
    }
  }
}
```

## Development Phases

### Phase 1: Walking Skeleton (2-3 weeks)
- [ ] Godot project setup with tile map
- [ ] Player movement (top-down, 8-directional)
- [ ] Single NPC with basic LLM dialogue
- [ ] Simple memory (last 5 interactions)
- [ ] Dialogue UI

### Phase 2: Memory & Personality (2-3 weeks)
- [ ] Full memory system (episodic + semantic + social)
- [ ] NPC persona system
- [ ] Memory-informed dialogue
- [ ] Basic day/night cycle
- [ ] NPC schedules

### Phase 3: Social Dynamics (3-4 weeks)
- [ ] Multiple NPCs (6-8)
- [ ] NPC-to-NPC gossip
- [ ] Emergent reputation
- [ ] Relationship evolution
- [ ] NPC autonomous behavior

### Phase 4: Emergent Economy & Quests (3-4 weeks)
- [ ] Resource/trade system
- [ ] Goal-driven quest emergence
- [ ] Supply chain disruption cascades
- [ ] Multiple interiors/locations
- [ ] Event system

### Phase 5: Polish & Content (ongoing)
- [ ] Art assets
- [ ] Sound/music
- [ ] More NPCs and locations
- [ ] Seasonal events
- [ ] Save/load polish
- [ ] Performance optimization

## Performance Considerations

- **LLM calls are async** — never block the game loop
- **Batch NPC updates** — not every NPC needs to update every frame
- **Memory retrieval is local** — keyword search, no external API needed
- **NPC-to-NPC gossip runs in background** — during player dialogue or exploration
- **Target:** 60 FPS with up to 20 NPCs active, <2s LLM response time

---

## Open Questions

1. **Local model support?** — Running a small LLM locally for offline play
2. **Multiplayer potential?** — Shared NPC memories across players
3. **Modding support?** — Custom NPC definitions, personality mods
4. **Voice synthesis?** — TTS for NPC dialogue (cost vs. immersion)
