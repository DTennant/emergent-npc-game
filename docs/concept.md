# Concept Document: Emergent NPC World

## One-Line Pitch

A 2D game where NPCs are AI agents with real memory, real personality, and real social lives — creating emergent stories no designer ever wrote.

## The Problem

Modern game NPCs are **stateless props**. They repeat the same lines, forget you saved their life yesterday, and follow scripts that break the moment a player does something unexpected. Even in games celebrated for narrative (Witcher 3, Baldur's Gate 3), NPCs are fundamentally _performances_ — brilliantly written, but static.

The result: players optimize around NPCs rather than relating to them. NPCs are vending machines with dialogue trees.

## The Insight

Three things have converged to make this solvable:

1. **LLM costs have plummeted** — A meaningful NPC conversation costs <$0.001 with models like Gemini Flash or Kimi K2.5
2. **Memory architectures are maturing** — Episodic memory, knowledge graphs, and parametric memory are active research areas with practical solutions
3. **Players are ready** — Undertale proved players form real emotional bonds with pixel characters. Give those characters actual memory and personality, and "emotional bond" becomes "genuine relationship"

## Core Innovation

**NPCs that accumulate experience and form unique relationships with each player.**

Not procedurally generated dialogue. Not chatbots with character descriptions. **Agents** with:
- Persistent episodic memory across sessions
- Personal goals that drive autonomous behavior
- Social networks where information and opinions propagate
- Evolving strategies based on accumulated interactions

## What Makes This Different

| Aspect | Traditional RPG | AI NPC World |
|--------|----------------|--------------|
| Dialogue | Branching tree (finite) | Generated from memory + personality (infinite) |
| Memory | Flag-based ("quest_completed = true") | Episodic ("you said X on day 3") |
| Reputation | Global number (+10 karma) | Per-NPC, socially propagated |
| Quests | Designed, triggered | Emergent from NPC needs |
| Replay Value | Same story, different choices | Fundamentally different story |
| NPC Death | "Game Over" or scripted event | Loss of irreplaceable relationship |

## Target Experience

### The First Hour
You arrive in a small village. NPCs greet you generically — you're a stranger. You help the farmer fix a fence. Later, at the inn, the innkeeper mentions "the farmer said someone helped him today." She offers you a free drink.

### After 10 Hours
The blacksmith knows your name, your fighting style, your weapon preferences. He's started setting aside materials he thinks you'll want. The merchant gives you discounts because you once saved her cart from bandits — and she told everyone. The village guard is suspicious of you because you were caught sneaking at night.

### The Gut Punch
A beloved NPC dies in a raid. Her last words reference a private joke you shared 8 hours ago. No other player will ever hear those words. The innkeeper holds a memorial and tells stories about her — stories that include you. The village feels her absence because the social network she maintained breaks apart.

This isn't scripted tragedy. It's **emergent loss**.

## Design Pillars

### 1. Relationships Are The Content
The game's replayability comes from NPC relationships, not content volume. 20 deep NPCs > 200 shallow ones.

### 2. Consequences Are Emergent
Actions have consequences that propagate through social systems, not designer-placed triggers. Burn the wheat field → baker can't bake → prices rise → poor NPCs go hungry → crime increases. This chain is simulated, not scripted.

### 3. Every Player's Story Is Unique
Because NPC memory is per-player and social dynamics are emergent, no walkthrough or guide can prepare you. Your experience is genuinely yours.

### 4. Memory Is Sacred
NPC memory creates a moral weight. When an NPC dies, their memory of you dies with them. Deleting a save file feels like something. This isn't engineered guilt — it's the natural consequence of genuine investment.

## Scope (MVP)

- **Setting:** Single village, 8-12 core NPCs
- **Gameplay:** Exploration, dialogue, simple quests (emergent), trade, day/night cycle
- **AI:** LLM-powered dialogue with persistent memory per NPC
- **Social System:** NPC-to-NPC information sharing, basic reputation propagation
- **Art Style:** Pixel art (16x16 or 32x32), top-down view
- **Session Length:** 30-60 min play sessions, memory persists across sessions
- **Platform:** Desktop (Godot 4 export)

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| LLM latency breaks immersion | Pre-generate common responses, async loading, local model fallback |
| LLM costs scale with players | Tiered model usage (cheap for small talk, expensive for plot moments) |
| NPC says something inappropriate | Safety layer + personality constraints + content filtering |
| Memory grows unbounded | Summarization, importance scoring, forgetting curve |
| "Uncanny valley" of AI dialogue | Strong personality definition, consistent character voice |

## Connection to Agent Ruliad / Self-Improving Systems

This project is a **concrete application** of multi-agent self-improvement principles:

- NPC behavior protocols can **evolve** through interaction (not just be designed)
- Successful social strategies get reinforced; failed ones decay
- The village as a whole exhibits **emergent intelligence** — adapting to player behavior patterns
- Each NPC is a node in what's essentially a **multi-agent system** with shared world state

The game world becomes a testbed for studying how agent societies develop norms, propagate information, and self-organize.

---

*"The best stories are the ones no one planned." — Every Dwarf Fortress player*
