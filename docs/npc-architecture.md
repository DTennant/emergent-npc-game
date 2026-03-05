# NPC Agent Architecture

## Overview

Each NPC is an autonomous agent with four core subsystems:

```
┌───────────────────────────────────────┐
│              NPC Agent                │
│                                       │
│  ┌──────────┐    ┌──────────────┐    │
│  │ Persona  │    │   Memory     │    │
│  │ (static) │    │  (dynamic)   │    │
│  └────┬─────┘    └──────┬───────┘    │
│       │                 │            │
│       ▼                 ▼            │
│  ┌──────────────────────────────┐    │
│  │       Decision Engine        │    │
│  │    (LLM + rule heuristics)   │    │
│  └──────────────┬───────────────┘    │
│                 │                    │
│                 ▼                    │
│  ┌──────────────────────────────┐    │
│  │      Action System           │    │
│  │  (dialogue, move, trade...)  │    │
│  └──────────────────────────────┘    │
└───────────────────────────────────────┘
```

## 1. Persona (Static Identity)

The unchanging core of who an NPC is. Defined at creation, rarely modified.

```json
{
  "id": "blacksmith_erik",
  "name": "Erik",
  "role": "Blacksmith",
  "age": 45,
  "personality": {
    "openness": 0.4,
    "conscientiousness": 0.8,
    "extraversion": 0.3,
    "agreeableness": 0.6,
    "neuroticism": 0.2
  },
  "values": ["craftsmanship", "honesty", "tradition"],
  "fears": ["losing his forge", "being unable to provide"],
  "speech_style": "Blunt, uses metalworking metaphors, few words",
  "backstory": "Third-generation blacksmith. Lost his wife to illness five years ago. Pours himself into his work.",
  "relationships_initial": {
    "merchant_anna": {"type": "business_partner", "trust": 0.7},
    "innkeeper_rose": {"type": "friend", "trust": 0.8}
  }
}
```

### Personality Model (Big Five)
We use the Big Five personality traits as a compact, psychologically-grounded way to give NPCs consistent behavioral tendencies:

- **Openness** → Willingness to try new things, curiosity about strangers
- **Conscientiousness** → Reliability, work ethic, orderliness
- **Extraversion** → Talkativeness, social initiative, energy
- **Agreeableness** → Cooperativeness, empathy, conflict avoidance
- **Neuroticism** → Emotional reactivity, worry, stress response

These traits influence LLM prompting and heuristic behavior decisions.

## 2. Memory System

The most critical subsystem. See [memory-system.md](memory-system.md) for full details.

### Memory Types

| Type | Description | Example | Retention |
|------|-------------|---------|-----------|
| **Episodic** | Specific events/interactions | "Player gave me iron ore on Day 3" | Importance-weighted decay |
| **Semantic** | General knowledge/beliefs | "The player is a skilled fighter" | Slow update, long retention |
| **Social** | Relationship states | "Trust: 0.8, Familiarity: high" | Continuous update |
| **Emotional** | Feelings and moods | "Grateful toward player" | Decays faster than semantic |

### Memory Retrieval for Dialogue
When generating a response, the NPC's relevant memories are retrieved and injected into the LLM prompt:

```
System: You are Erik, the village blacksmith. [persona details]

Recent memories about this person:
- Day 3: They brought you rare iron ore from the northern mines
- Day 5: They asked about your late wife, you appreciated their kindness
- Day 7: They defended the village during the wolf attack

Current mood: Content, slightly tired (end of workday)
Current goals: Finish the merchant's order, find better coal supply

Player says: "Hey Erik, how's the sword coming along?"
```

## 3. Decision Engine

Combines LLM reasoning with lightweight heuristics for efficiency.

### Decision Hierarchy

```
Priority 1: Survival (flee danger, find shelter)        → Rule-based
Priority 2: Urgent needs (hunger, safety)               → Rule-based
Priority 3: Social obligations (promises, appointments) → Hybrid
Priority 4: Personal goals (crafting, trading)           → LLM-assisted
Priority 5: Social initiative (gossip, visiting)         → LLM-assisted
Priority 6: Idle behavior (wander, rest)                 → Rule-based
```

### When to Call the LLM

Not every NPC decision needs an LLM call. We use a **tiered approach**:

| Situation | Engine | Why |
|-----------|--------|-----|
| Player initiates dialogue | LLM (full) | Core experience, must be high quality |
| NPC-to-NPC important conversation | LLM (summarized) | Generates gossip/info to spread |
| Routine behavior (walking, working) | Heuristic | No need for LLM, saves cost |
| Reaction to world event | LLM (brief) | Determines emotional response |
| Goal planning (daily) | LLM (structured) | What does this NPC want to do today? |

### Prompt Architecture

```
[SYSTEM PROMPT]
You are {name}, {role} in the village of {village_name}.
Personality: {personality_description}
Speaking style: {speech_style}

[MEMORY CONTEXT]
{retrieved_relevant_memories}

[WORLD CONTEXT]  
Time: {time_of_day}, Day {day_number}
Location: {current_location}
Weather: {weather}
Recent village events: {recent_events}

[SOCIAL CONTEXT]
Relationship with speaker: {relationship_summary}
Current mood: {mood}
Active goals: {goals}

[INSTRUCTION]
Respond in character. Your response should include:
1. dialogue: What you say (1-3 sentences, in character)
2. internal_thought: What you're thinking (for memory storage)
3. mood_change: How this interaction affects your mood (-1 to 1)
4. action: Any physical action you take (optional)
```

### Response Format

```json
{
  "dialogue": "That sword? Almost done. The edge needs another hour on the whetstone. Used that ore you brought — finest I've worked in years.",
  "internal_thought": "They seem genuinely interested in the craft. Rare for an adventurer.",
  "mood_change": 0.1,
  "action": "holds_up_unfinished_sword",
  "memory_to_store": "Player asked about sword progress, seemed interested in craftsmanship"
}
```

## 4. Action System

Translates decisions into game-world actions.

### Action Types

```gdscript
enum NPCAction {
    IDLE,
    WALK_TO,
    WORK,
    TALK_TO_PLAYER,
    TALK_TO_NPC,
    TRADE,
    GIVE_ITEM,
    FLEE,
    SLEEP,
    EAT,
    EMOTE
}
```

### Daily Schedule (Default)

NPCs have a base schedule that can be disrupted by events:

```
06:00 - Wake up, eat
07:00 - Walk to workplace
08:00 - Work
12:00 - Lunch (social time, visit inn or eat at workplace)
13:00 - Work
17:00 - Free time (visit friends, shop, walk)
19:00 - Evening meal at inn (primary social hub)
21:00 - Walk home
22:00 - Sleep
```

Schedule is personality-dependent (conscientious NPCs are punctual, open NPCs wander more).

## 5. NPC Lifecycle

### Initialization
1. Load persona from definition file
2. Load persistent memory from save file
3. Generate daily goals via LLM
4. Start behavior loop

### Per-Tick Update (Game Loop)
1. Check for immediate threats (rule-based)
2. Check if player is nearby (trigger interaction range)
3. Execute current action / advance toward goal
4. Observe environment, store observations as memories
5. Every N minutes: NPC-to-NPC social interaction (if near another NPC)

### Save/Load
- Memory serialized to JSON
- Relationship graph saved separately
- World state checkpoint includes all NPC states
- On load: reconstruct from save, LLM generates "what happened while away" summary

## 6. NPC Communication Protocol

### Player → NPC
Direct dialogue. Full LLM response with memory retrieval.

### NPC → NPC
Simplified "gossip packets":

```json
{
  "from": "innkeeper_rose",
  "to": "blacksmith_erik", 
  "type": "gossip",
  "subject": "player",
  "content": "A stranger helped the farmer today. Seems decent.",
  "reliability": 0.7,
  "timestamp": "day_1_evening"
}
```

NPCs evaluate gossip based on:
- Trust in the source
- Consistency with their own observations
- Personality (high openness = more accepting of new info)

### NPC → World
Actions that modify world state (trading, crafting, moving objects) are broadcast as events that other NPCs can observe.

---

## Design Principles

1. **Consistency > Creativity** — NPCs should feel like the same person across interactions
2. **Silence is valid** — Not every NPC needs to talk. A grunt or a nod is fine.
3. **Memory creates meaning** — The value of interaction comes from being remembered
4. **Autonomy creates life** — NPCs should do things even when the player isn't watching
5. **Social fabric matters** — Destroy a relationship and the whole network shifts
