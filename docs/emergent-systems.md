# Emergent Systems Design

## Philosophy

Traditional game design: **Author writes possibilities → Player chooses among them**
Emergent game design: **Designer creates rules and agents → Stories emerge from interaction**

We don't script what happens. We create the conditions for things to happen.

## System 1: Social Information Network

### How Information Flows

```
Event occurs (player helps farmer)
    │
    ▼
Farmer stores memory (episodic, high importance)
    │
    ▼
Farmer visits inn in the evening
    │
    ▼
Farmer tells innkeeper (gossip packet)
    │
    ▼
Innkeeper evaluates:
  - Trust in farmer? High (0.8)
  - Consistent with prior observations? Neutral
  - Interesting enough to remember? Yes
    │
    ▼
Innkeeper stores as hearsay memory
    │
    ▼
Next day, innkeeper mentions it to merchant
    │
    ▼
Information has propagated 2 hops from source
```

### Gossip Mechanics

**What NPCs share:**
- Events involving the player (positive and negative)
- Events involving other NPCs
- World events (monster sightings, weather, resource changes)
- Opinions and warnings

**What affects propagation:**
- **Relationship closeness** — Friends share more
- **Personality** — Extraverts gossip more; conscientious NPCs share important info
- **Relevance** — NPCs share info relevant to the listener's role/goals
- **Distortion** — Each retelling can slightly alter the story (telephone game)

### Reputation as Emergent Property

Player reputation is NOT a number. It's the **sum of what NPCs believe about you**.

```
Blacksmith Erik:  "Good customer, brought rare ore, trustworthy" → Positive
Innkeeper Rose:   "Heard they helped the farmer, seems decent" → Mildly positive  
Guard Marcus:     "Caught sneaking at night, suspicious" → Negative
Merchant Anna:    "Saved my cart, reliable" → Very positive
```

Your "reputation" is different depending on who you ask. There's no global score — just a social network of opinions.

## System 2: Emergent Economy

### Resource Flow

```
Farmer → (wheat) → Baker → (bread) → Customers
                              ↓
                         Innkeeper (buys bread for meals)
                              ↓
                         Travelers (buy meals)

Miner → (ore) → Blacksmith → (tools/weapons) → Everyone
```

### Disruption Cascades

Player burns wheat field:
1. Farmer has no wheat → Can't sell to baker
2. Baker has no flour → Bread prices spike
3. Innkeeper can't serve meals → Loses income
4. Poor NPCs can't afford food → Mood drops, crime potential rises
5. Farmer asks player for help (emergent quest) OR asks guards to investigate

This cascade is **simulated**, not scripted. The same systems produce different cascades based on different disruptions.

### Trade System

```json
{
  "item": "iron_sword",
  "base_price": 50,
  "current_price": 55,
  "price_factors": {
    "supply": 0.9,
    "demand": 1.1,
    "relationship_discount": 0.95,
    "village_prosperity": 1.0
  }
}
```

Prices are dynamic based on supply, demand, and NPC relationships.

## System 3: Goal-Driven Quest Emergence

### NPC Goals

Each NPC has a hierarchy of needs (loosely inspired by Maslow):

```
Level 4: Self-actualization (master their craft, leave a legacy)
Level 3: Social (friendship, respect, community standing)
Level 2: Security (safety, stable income, shelter)
Level 1: Survival (food, water, health)
```

When a lower-level need is threatened, the NPC focuses on it → potential quest emergence.

### Quest Generation Flow

```
NPC Goal Check (daily):
  "Do I have any unmet needs?"
    │
    ├── No → Continue normal routine
    │
    └── Yes → "Can I solve this myself?"
              │
              ├── Yes → NPC takes action autonomously
              │         (buy supplies, repair, visit friend)
              │
              └── No → "Is there someone who could help?"
                        │
                        ├── Another NPC → Ask them (NPC-to-NPC quest)
                        │
                        └── Player → Approach player with request
                                     (EMERGENT QUEST)
```

### Example: Emergent Quest

```
Baker's flour supply is low (farmer's field was damaged)
  → Baker's goal: "secure flour supply" (Level 2: Security)
  → Baker can't solve alone (no alternative supplier known)
  → Baker approaches player:

"Hey, you seem like someone who gets around. 
 The farmer's field got torn up by those wolves last week,
 and I'm running low on flour. I heard there might be
 a mill in the eastern valley — could you check if they
 have any to spare? I'd make it worth your while."
```

This quest was **never designed**. It emerged from:
1. Wolf attack event (could be player-caused or random)
2. Supply chain disruption
3. NPC goal system detecting unmet need
4. NPC evaluating available help

## System 4: Day/Night & Seasonal Cycles

### Daily Rhythm

The village has a heartbeat:

```
Dawn (6:00)    → NPCs wake, farmers head to fields
Morning (8:00) → Shops open, craftsmen work
Midday (12:00) → Social gathering at inn, trading
Afternoon      → Work continues, children play
Evening (18:00)→ Inn fills up, gossip flows, relationships deepen
Night (22:00)  → Most NPCs sleep, guards patrol
Late Night     → Danger window (monsters, crime, secrets)
```

### Seasonal Events

Seasons affect gameplay and NPC behavior:

- **Spring:** Planting, optimism, festivals
- **Summer:** Trade caravans, abundance, outdoor events
- **Autumn:** Harvest, preparation, trading frenzy
- **Winter:** Scarcity, indoor socialization, survival pressure

Seasons create natural pressure cycles that drive emergent behavior.

## System 5: Emergent Culture

### Village Memory

Beyond individual NPC memory, the village develops collective memory:

```json
{
  "village_memories": [
    {"event": "wolf_attack_day_5", "impact": "high", "NPCs_affected": 8},
    {"event": "player_arrived_day_1", "impact": "medium", "NPCs_affected": 3},
    {"event": "harvest_festival_day_14", "impact": "positive", "NPCs_affected": 12}
  ],
  "collective_beliefs": {
    "player_reputation": "mostly_positive",
    "current_threats": ["wolves_in_forest"],
    "village_mood": "cautiously_optimistic"
  }
}
```

### Norm Emergence

Over time, NPC interactions produce emergent social norms:

- If players consistently steal → NPCs become more suspicious of strangers
- If players consistently help → NPCs become more welcoming
- If violence is common → NPCs arm themselves, hire guards
- If trade flourishes → NPCs become more entrepreneurial

These norms persist across player sessions and slowly shift the village's character.

## System 6: Event System

### Event Types

```gdscript
enum EventType {
    NATURAL,      # Weather, seasons, wildlife
    SOCIAL,       # Festivals, arguments, marriages
    ECONOMIC,     # Trade, shortages, windfalls
    THREAT,       # Monsters, bandits, disease
    PLAYER,       # Player actions
    NPC_INITIATED # NPC-driven events
}
```

### Event Propagation

```
Event occurs
    │
    ├── Direct observers store episodic memory
    │
    ├── World state updates (supply, safety, etc.)
    │
    ├── Nearby NPCs react (emotion, behavior change)
    │
    └── Information enters gossip network
         └── Reaches NPCs who weren't present
              └── May trigger secondary reactions/quests
```

## Interaction Between Systems

The power of emergent design comes from **system interactions**:

| System A | × System B | = Emergent Result |
|----------|-----------|-------------------|
| Economy | Social Network | NPCs trade based on relationships, not just price |
| Memory | Quest Generation | Quests reference past events ("remember when...") |
| Gossip | Reputation | Your reputation precedes you in places you've never been |
| Day/Night | Social | Evening at the inn is when gossip flows fastest |
| Goals | Economy | NPC economic needs drive quest generation |
| Culture | Memory | Village collectively remembers player actions |

---

## Key Insight

> "Emergent gameplay is not about removing the designer. It's about the designer creating **systems** instead of **scripts**. The systems interact to produce experiences that surprise even their creator."

The game world doesn't need a story. It needs **rules that inevitably produce stories**.
