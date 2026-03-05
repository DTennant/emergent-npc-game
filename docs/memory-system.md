# Memory System Design

## Overview

Memory is the heart of the emergent NPC system. It transforms NPCs from stateless chatbots into beings with history, opinions, and genuine relationships.

## Architecture

```
┌─────────────────────────────────────────────┐
│                Memory Manager               │
│                                             │
│  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Episodic  │  │ Semantic  │  │ Social  │ │
│  │ Memory    │  │ Memory    │  │ Memory  │ │
│  │ (events)  │  │ (beliefs) │  │ (rels)  │ │
│  └─────┬─────┘  └─────┬─────┘  └────┬────┘ │
│        │              │              │      │
│        ▼              ▼              ▼      │
│  ┌──────────────────────────────────────┐   │
│  │        Retrieval Engine              │   │
│  │  (relevance scoring + recency bias)  │   │
│  └──────────────────────────────────┬───┘   │
│                                     │       │
│                                     ▼       │
│                            Context Window   │
│                          (for LLM prompt)   │
└─────────────────────────────────────────────┘
```

## Memory Types

### 1. Episodic Memory (What Happened)

Specific events and interactions, stored chronologically.

```json
{
  "id": "mem_001",
  "timestamp": "day_3_14:30",
  "type": "interaction",
  "participants": ["player"],
  "location": "forge",
  "summary": "Player brought rare iron ore from northern mines. Seemed excited about it.",
  "emotional_valence": 0.7,
  "importance": 0.8,
  "tags": ["player", "trade", "ore", "positive"],
  "decay_rate": 0.01
}
```

**Importance Scoring:**
- Emotional intensity (high emotion = more memorable)
- Novelty (first-time events score higher)
- Relevance to goals (events related to NPC's goals are more important)
- Social significance (events involving close relationships score higher)

**Forgetting Curve:**
Memories decay over time based on importance and reinforcement:

```
retention = importance * e^(-decay_rate * days_since_event)
```

Low-importance memories fade; high-importance ones persist. Recalled memories get a retention boost (retrieval practice effect).

### 2. Semantic Memory (What I Know/Believe)

Generalized knowledge derived from episodic memories.

```json
{
  "subject": "player",
  "beliefs": [
    {"fact": "skilled_fighter", "confidence": 0.8, "source": "observed_wolf_attack"},
    {"fact": "interested_in_craftsmanship", "confidence": 0.6, "source": "multiple_conversations"},
    {"fact": "trustworthy", "confidence": 0.7, "source": "kept_promises"}
  ],
  "last_updated": "day_7"
}
```

Semantic memories are **consolidated** from episodic memories:
- After N interactions with the same person, patterns become beliefs
- Beliefs update slowly (resistant to single contradictions)
- Confidence changes with supporting/contradicting evidence

### 3. Social Memory (Relationships)

Relationship state with every known entity.

```json
{
  "target": "player",
  "familiarity": 0.7,
  "trust": 0.6,
  "affection": 0.5,
  "respect": 0.8,
  "fear": 0.0,
  "interaction_count": 12,
  "first_met": "day_1",
  "last_interaction": "day_7",
  "relationship_label": "valued_customer",
  "significant_events": ["brought_rare_ore", "defended_village"]
}
```

**Relationship Dimensions:**
- **Familiarity** — How well they know the person (interaction frequency)
- **Trust** — Reliability, honesty (built slowly, broken quickly)
- **Affection** — Emotional warmth, liking
- **Respect** — Admiration for skills/character
- **Fear** — Intimidation, avoidance

## Memory Operations

### Store

When something happens, the Memory Manager:
1. Creates an episodic memory entry
2. Scores importance (emotion × novelty × relevance)
3. Updates relevant semantic beliefs
4. Updates social memory for involved parties
5. Persists to save file

### Retrieve

When the NPC needs to respond or decide:
1. Query with context (who's talking, what about, current situation)
2. Score all memories by relevance:
   ```
   relevance = similarity(query, memory) × recency × importance × retention
   ```
3. Return top-K memories as context for LLM
4. Boost retention of retrieved memories

### Consolidate

Periodically (e.g., at "sleep" time):
1. Review recent episodic memories
2. Extract patterns → update semantic beliefs
3. Summarize old episodic memories (compress details, keep essence)
4. Prune memories below retention threshold

### Gossip Integration

When NPC receives information from another NPC:
1. Create episodic memory tagged as "hearsay"
2. Weight by trust in source
3. May update semantic beliefs (if consistent with existing knowledge)
4. May create/update social memory for the gossip subject

## Storage Format

### Per-NPC Memory File

```
save/
├── world_state.json
└── npcs/
    ├── blacksmith_erik/
    │   ├── persona.json          # Static identity
    │   ├── episodic_memory.json  # Event memories
    │   ├── semantic_memory.json  # Beliefs and knowledge
    │   ├── social_memory.json    # Relationships
    │   └── state.json            # Current mood, goals, location
    ├── innkeeper_rose/
    │   └── ...
    └── ...
```

## Memory Budget

To prevent unbounded growth:

| Memory Type | Max Entries | Strategy |
|-------------|-------------|----------|
| Episodic | 200 per NPC | Importance-based pruning, old memories summarized |
| Semantic | 50 beliefs per subject | Confidence-based pruning |
| Social | All known entities | Compact format, ~500 bytes each |

### Compression Strategy

Old episodic memories get **summarized**:

```
Before (3 memories):
- "Day 1: Player bought a dagger"
- "Day 3: Player bought a shield"  
- "Day 5: Player asked about armor"

After (1 consolidated memory):
- "Player is a regular customer, interested in weapons and armor. Visits every few days."
```

This mirrors how human memory works: specific details fade, but the gist remains.

## Context Window Management

LLM context is precious. We budget it carefully:

```
Total context budget: ~2000 tokens for memory

Allocation:
- Persona description: 200 tokens (always included)
- Top 5 episodic memories: 500 tokens
- Relevant semantic beliefs: 200 tokens  
- Relationship summary: 100 tokens
- Current world context: 200 tokens
- Recent conversation history: 500 tokens
- Instruction + response format: 300 tokens
```

## Implementation Notes

### GDScript Memory Manager

```gdscript
class_name MemoryManager

var episodic_memories: Array[Dictionary] = []
var semantic_memory: Dictionary = {}
var social_memory: Dictionary = {}

func store_episodic(event: Dictionary) -> void:
    event["importance"] = _score_importance(event)
    event["retention"] = 1.0
    episodic_memories.append(event)
    _update_semantic(event)
    _update_social(event)
    _prune_if_needed()

func retrieve(query: String, k: int = 5) -> Array[Dictionary]:
    var scored = []
    for mem in episodic_memories:
        var score = _relevance_score(query, mem)
        scored.append({"memory": mem, "score": score})
    scored.sort_custom(func(a, b): return a.score > b.score)
    # Boost retention of retrieved memories
    for i in range(min(k, scored.size())):
        scored[i].memory.retention = min(1.0, scored[i].memory.retention + 0.1)
    return scored.slice(0, k).map(func(s): return s.memory)

func consolidate() -> void:
    # Called during NPC "sleep"
    _summarize_old_memories()
    _extract_beliefs()
    _apply_decay()
    _prune_below_threshold()
```

### Relevance Scoring

Simple but effective — can be upgraded to embedding-based later:

```gdscript
func _relevance_score(query: String, memory: Dictionary) -> float:
    var keyword_overlap = _keyword_similarity(query, memory.summary)
    var recency = 1.0 / (1.0 + days_since(memory.timestamp))
    var importance = memory.importance
    var retention = memory.retention
    return keyword_overlap * 0.4 + recency * 0.2 + importance * 0.2 + retention * 0.2
```

Future upgrade path: use embeddings (via API) for semantic similarity search.

---

## Design Principles

1. **Memory creates meaning** — Without memory, NPCs are just chatbots. Memory is what makes "I remember when you..." powerful.
2. **Forgetting is features** — Humans forget. NPCs should too. It creates realistic interactions and manages resources.
3. **Hearsay is imperfect** — Information from gossip should be less reliable than first-hand experience.
4. **Retrieval > Storage** — Storing everything is easy. Retrieving the *right* memories at the *right* time is the hard problem.
5. **Compression mirrors cognition** — Summarizing old memories into beliefs mirrors how human memory works.
