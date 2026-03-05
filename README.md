# 🌍 Emergent NPC World

**AI-driven NPCs with memory, personality, and emergent social dynamics — built with Godot 4**

> What if game NPCs weren't scripted actors, but living beings that remember you, form opinions, and create stories no designer ever wrote?

## Vision

This project explores the intersection of **Large Language Models**, **multi-agent systems**, and **emergent game design** to create NPCs that:

- **Remember** every interaction with the player — and each other
- **Have goals** that drive autonomous behavior (not scripted triggers)
- **Spread information** through social networks (gossip, rumors, reputation)
- **Evolve** their strategies through accumulated experience
- **Create emergent narratives** that no game designer explicitly authored

The result: a game world where your reputation is *earned*, not assigned; where killing an NPC means losing a *unique relationship*; where every playthrough tells a story that has never been told before.

## Architecture

```
┌─────────────────────────────────────────┐
│              Godot 4 Engine             │
│         (Rendering, Physics, UI)        │
├─────────────────────────────────────────┤
│           Behavior Layer                │
│    (Movement, Animation, Interaction)   │
├─────────────────────────────────────────┤
│          NPC Agent Layer                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Memory   │ │Goals &  │ │Person-  │   │
│  │System   │ │Planning │ │ality    │   │
│  └────┬────┘ └────┬────┘ └────┬────┘   │
│       └───────────┼───────────┘        │
│                   ▼                     │
│            LLM API Bridge               │
├─────────────────────────────────────────┤
│           World State Layer             │
│  ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │Knowledge │ │Social    │ │Event   │  │
│  │Graph     │ │Network   │ │History │  │
│  └──────────┘ └──────────┘ └────────┘  │
└─────────────────────────────────────────┘
```

## Project Structure

```
emergent-npc-game/
├── docs/                    # Design documents
│   ├── concept.md           # Core concept & vision
│   ├── npc-architecture.md  # NPC agent system design
│   ├── emergent-systems.md  # Emergent gameplay mechanics
│   ├── memory-system.md     # Memory & knowledge architecture
│   └── technical-spec.md    # Technical implementation details
├── godot/                   # Godot 4 project
│   ├── project.godot        # Project configuration
│   ├── scenes/              # Game scenes
│   ├── scripts/             # GDScript files
│   │   ├── npc/             # NPC agent system
│   │   ├── world/           # World state management
│   │   ├── ai/              # LLM integration
│   │   └── ui/              # UI components
│   ├── resources/           # Game resources
│   └── assets/              # Art, audio, etc.
└── README.md
```

## Key Concepts

### 🧠 Memory-Driven NPCs
Each NPC maintains episodic memory of interactions. The blacksmith remembers you brought him rare ore last week. The innkeeper knows you always order ale. These memories shape how NPCs treat you — and what they tell others about you.

### 🌐 Social Information Network  
NPCs talk to each other. Help the farmer, and the merchant might give you a discount — because she heard about it. Steal from the baker, and guards across town become suspicious. Information propagates through social connections, not omniscient game scripts.

### 🎯 Goal-Driven Autonomy
NPCs have desires, fears, and plans. The baker wants to feed his family. If wheat prices rise (because you burned the fields), he'll seek alternative suppliers, raise prices, or ask for help. Quests emerge from NPC needs, not designer scripts.

### 🔄 Emergent Narrative
No two playthroughs are the same. The story of your game is the sum of thousands of small emergent interactions — alliances formed, grudges held, rumors spread, economies shifted. You're not following a plot; you're *creating* one.

## Tech Stack

- **Engine:** Godot 4.x (GDScript)
- **AI Backend:** LLM API (OpenAI / local models via LiteLLM)
- **Data:** JSON-based world state & memory persistence
- **Target:** Desktop (Windows/Mac/Linux), potentially Web export

## Status

🚧 **Early Development** — Architecture design & prototype phase

## Inspirations

- **Dwarf Fortress** — Deep emergent storytelling through simulation
- **RimWorld** — Agent need/goal driven behavior
- **Caves of Qud** — Rich procedural world-building
- **AI Town (Stanford)** — LLM agents with memory in a social simulation
- **Undertale** — Emotional connection with pixel characters

## License

MIT

---

*Built with curiosity about what happens when NPCs stop being decorations and start being beings.*
