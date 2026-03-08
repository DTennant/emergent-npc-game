# AGENTS.md — Emergent NPC World

AI-driven NPCs with memory, personality, and emergent social dynamics.
Built with Phaser 3, TypeScript, and Vite. Browser-native game targeting localhost:8080.

## Vision & Status

**Core idea**: NPCs are autonomous agents with persistent memory, personality, and social networks — creating emergent stories no designer ever wrote. Inspired by Dwarf Fortress (emergent storytelling), AI Town (LLM agents), and Zelda: Breath of the Wild (open-world exploration).

**Status**: Early development. Migrated from Godot 4 prototype to Phaser 3 (no Godot code remains). The technical-spec.md still references GDScript — the authoritative implementation is the TypeScript code in `src/`.

## Storyline

**Premise**: Player awakens near Thornwick village with no memory. A mysterious darkness — the **Blight** — spreads from the Ancient Forest, corrupting wildlife. Village elder **Sage Aldric** vanished, leaving journal clues. Player must find **3 Runestones** from 3 mini-dungeons to activate the **Shrine of Dawn** and seal the Blight.

**Dungeons**: Forest Cave (Shadow Wolf boss, requires lantern), Abandoned Mine (Crystal Golem boss, requires rope), Ruined Tower (Blight Wraith boss, requires enchanted blade).

**NPC Roles in Main Quest** (relationship-gated — trust thresholds determine cooperation):
- **Erik** (blacksmith): Forges extraction tools (trust >= 0.6, needs raw iron)
- **Rose** (innkeeper): Deciphers Aldric's journal (trust >= 0.5, familiarity >= 0.5)
- **Willow** (herbalist): Brews protection potions (trust >= 0.5, needs moonpetal)
- **Marcus** (guard): Provides tactical intel and escort (trust >= 0.7)
- **Thomas** (farmer): Supplies provisions for dungeon runs (trust >= 0.4)
- **Anna** (merchant): Sources rare materials (trust >= 0.5, player pays gold)

**Design principle**: The main quest is short and structured. The real game is the emergent relationships, gossip networks, and NPC-driven stories that unfold around it.

## Build & Run Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 8080
npm run build        # TypeScript check + Vite production build (tsc && vite build)
npm run preview      # Preview production build
npx tsc --noEmit     # Type-check only (no output)
```

There is **no test framework** configured. No linter or formatter (no ESLint, no Prettier).
If adding tests, use Vitest (already Vite-based). If adding linting, use ESLint with typescript-eslint.

### Playwright Debugging

When using the Playwright MCP for browser debugging/QA, **always open a new tab first** (`browser_tabs` action `new`) before navigating. The Phaser canvas is not accessible from the default browser context without a fresh tab.

A `__DEBUG__` global object is available in the browser console with helpers like `scenes()`, `enterBuilding(id)`, `tp(x,y)`, `buildings()`, `god()`, etc. Use `browser_evaluate` to call these.

## Project Structure

```
src/
├── main.ts              # Entry point — Phaser.Game bootstrap, scene registration
├── config.ts            # Game constants (dimensions, speeds, colors, combat, blight)
├── ai/
│   └── LLMClient.ts     # OpenAI/LiteLLM API client with request queue, structured JSON responses
├── assets/
│   └── keys.ts          # TextureKeys constants + NPC_TEXTURE_MAP for swappable art
├── combat/
│   ├── CombatSystem.ts  # Player attacks, damage, health, i-frames, death
│   ├── HealthBar.ts     # Reusable health bar component (player + enemies)
│   ├── Enemy.ts         # Enemy class with AI states (patrol/chase/attack), drops
│   └── EnemyAI.ts       # Enemy state machine (patrol, chase, attack, dead)
├── dungeons/
│   ├── DungeonData.ts   # 3 dungeon layouts (Forest Cave, Abandoned Mine, Ruined Tower)
│   └── BossEnemy.ts     # Boss enemies with boss health bar, runestone drops
├── inventory/
│   ├── types.ts         # ItemDef, InventorySlot, ITEMS constant (19 items)
│   └── Inventory.ts     # Player inventory with equip/serialize
├── memory/
│   ├── types.ts         # EpisodicMemory, SemanticBelief, SocialRelationship, LLMResponse, NPCGoal, GossipPacket
│   └── MemoryManager.ts # Per-NPC memory (episodic, semantic, social, gossip)
├── npc/
│   ├── personas.ts      # NPCPersona interface + NPC_PERSONAS data (6 NPCs with goals)
│   ├── NPC.ts           # NPC class — physics sprite, mood, goals, dialogue, quest gates
│   ├── GossipSystem.ts  # NPC-to-NPC gossip exchange based on proximity + trust
│   └── GoalSystem.ts    # NPC goal tracking and LLM context injection
├── persistence/
│   └── SaveManager.ts   # localStorage save/load for full game state
├── quest/
│   └── QuestGates.ts    # Trust/familiarity thresholds gating NPC quest cooperation
├── scenes/
│   ├── BootScene.ts     # Loading screen, procedural texture generation for all sprites
│   ├── WorldScene.ts    # Main game — player, NPCs, enemies, combat, dungeons, shrine
│   ├── DungeonScene.ts  # Dungeon exploration — rooms, bosses, runestone collection
│   ├── DialogueScene.ts # Chat UI overlay with storyline context
│   ├── InventoryScene.ts# Inventory grid overlay (I key)
│   └── HUDScene.ts      # HUD — time, day, equipped weapon, notifications
├── story/
│   ├── AldricJournal.ts # 5 discoverable journal pages with dungeon clues
│   └── StorylineManager.ts # Quest progression (Blight awareness, dungeons, shrine)
└── world/
    ├── EventBus.ts      # Global EventEmitter + 25+ event constants
    ├── WorldState.ts    # Game clock, village state, blight data
    ├── BlightSystem.ts  # Blight intensity, visual overlays, wolf spawn scaling
    └── VillageMemory.ts # Collective village events, reputation, gossip promotion
```

## Architecture

- **Phaser 3** scenes: `BootScene` → `WorldScene` (+ `HUDScene` + `DialogueScene` as overlays)
- **NPC agent system**: Each NPC has a `MemoryManager` (episodic + semantic + social memory)
- **LLM integration**: `LLMClient` calls OpenAI-compatible API (OpenAI or LiteLLM proxy) with NPC persona + memory context; falls back to canned responses when no API key
- **Event-driven**: `EventBus` (global `Phaser.Events.EventEmitter`) for cross-system communication
- **No physics**: Movement is manual (dx/dy math), no Phaser physics engine

### Key dependency flow

```
main.ts → scenes/* → NPC, LLMClient, WorldState
NPC → MemoryManager, LLMClient, WorldState, config
MemoryManager → types, EventBus
WorldState → EventBus, config
EventBus → Phaser (standalone)
```

## TypeScript Configuration

- **Target**: ES2020, **Module**: ESNext, **moduleResolution**: bundler
- **strict: true** — all strict checks enabled
- **Lib**: ES2020, DOM, DOM.Iterable
- No path aliases — use relative imports only

## Code Style

### Imports

- **External packages**: Default import (`import Phaser from 'phaser'`)
- **Internal modules**: Named imports with relative paths (`import { NPC } from '../npc/NPC'`)
- **Ordering**: External packages first, then internal modules (no blank line separator used, but keep this order)
- **No barrel files** (no `index.ts` re-exports) — import directly from the source file

```typescript
import Phaser from 'phaser';
import { NPC } from '../npc/NPC';
import { NPC_PERSONAS } from '../npc/personas';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';
```

### Naming Conventions

| What | Convention | Examples |
|------|-----------|----------|
| Classes | PascalCase | `NPC`, `LLMClient`, `WorldState`, `MemoryManager` |
| Interfaces | PascalCase | `NPCPersona`, `EpisodicMemory`, `MemoryContext`, `DialogueData` |
| Constants (module-level) | UPPER_SNAKE_CASE | `GAME_WIDTH`, `TILE_SIZE`, `NPC_SPEED`, `DAY_LENGTH_MS` |
| Constant objects | UPPER_SNAKE_CASE | `COLORS`, `NPC_COLORS`, `NPC_PERSONAS`, `FALLBACK_RESPONSES` |
| Variables & params | camelCase | `gameTime`, `wanderTarget`, `currentActivity` |
| Private fields | camelCase (no prefix) | `this.apiKey`, `this.queue`, `this.processing` |
| Methods | camelCase | `generateDialogue()`, `buildContext()`, `getRelationship()` |
| Event constants | UPPER_SNAKE_CASE values | `DIALOGUE_START: 'dialogue:start'` |
| File names | PascalCase for classes, camelCase for data/config | `WorldScene.ts`, `personas.ts`, `config.ts` |

### Types & Interfaces

- **Prefer `interface`** for object shapes: `interface EpisodicMemory { ... }`
- **Use `export interface`** — all interfaces are exported from their definition file
- **Inline object types** for function parameters when used once: `params: { day: number; gameTime: string; ... }`
- **Union literal types** for constrained values: `type: 'interaction' | 'observation' | 'gossip' | 'event'`
- **Range comments** for numeric fields: `trust: number; // 0 to 1`
- **`Record<string, T>`** for dictionaries: `Record<string, number>`, `Record<string, string>`
- **Type definitions live in dedicated files** (`memory/types.ts`) or co-located with the class that owns them
- **`as const`** for immutable constant objects (see `Events` in `EventBus.ts`)

### Classes & Functions

- **Classes** for stateful game objects: `NPC`, `LLMClient`, `MemoryManager`, `WorldState`
- **Phaser scenes** extend `Phaser.Scene` with `constructor() { super({ key: 'SceneName' }) }`
- **Methods** use regular method syntax (not arrow functions)
- **Private methods** use `private` keyword (no `#` prefix)
- **Definite assignment** (`!`) used for properties set in `init()`/`create()`: `private npc!: NPC`
- **Export at declaration**: `export class`, `export interface`, `export const` — no bottom-of-file exports
- **One class per file**, file named after the class

### Error Handling

- **try/catch** in async API calls with `console.error()` logging
- **Fallback behavior** over throwing: LLMClient returns canned responses on API failure
- **Optional chaining**: `data.choices?.[0]?.message?.content ?? 'fallback'`
- **Nullish coalescing**: `params.importance ?? 0.5`
- **No custom error classes** — use built-in `Error`

### Comments

- **Section separators** with `// --- Section Name ---` in large classes (see `MemoryManager.ts`)
- **Inline comments** for non-obvious logic: `// retrieval practice: slower decay`
- **Value annotations** on declarations: `private gameTime = 0; // in-game minutes (0 = 6:00 AM)`
- **No JSDoc** — no doc comments on functions/classes
- **No TODO/FIXME** conventions established

### Formatting (no enforced formatter)

- **2-space indentation**
- **Single quotes** for strings
- **Semicolons** required
- **Trailing commas** in multi-line objects/arrays
- **`const`** by default, `let` only when reassignment needed, never `var`
- **Template literals** for string interpolation: `` `Day ${day}` ``

## Phaser-Specific Patterns

- Scenes registered by class reference in `Phaser.Game` config: `scene: [BootScene, WorldScene, ...]`
- Overlay scenes launched with `this.scene.launch('SceneName', data)`
- Data passed between scenes via `init(data)` method
- Keyboard input via `this.input.keyboard!.addKey()` and `createCursorKeys()`
- GameObjects are primitives (rectangles, text) — no sprite sheets or asset loading
- Depth layering: background=0, buildings=1-2, NPCs=5-6, player=10-11, UI=50+, HUD=100+

## Environment & Secrets

- **No `.env` file** — API key stored in `localStorage`
- Set API key in browser console: `localStorage.setItem("openai_api_key", "sk-...")`
- Never commit API keys, `.env`, or `config.json` (covered by `.gitignore`)

## Dependencies

- **Runtime**: `phaser` (^3.90.0) — the only runtime dependency
- **Dev**: `typescript` (^5.0.0), `vite` (^6.0.0)
- Extremely lean dependency tree — avoid adding packages unless clearly justified

## Design Docs

Detailed design documents exist in `docs/`:
- `concept.md` — Core vision and game design
- `npc-architecture.md` — NPC agent system design
- `emergent-systems.md` — Emergent gameplay mechanics
- `memory-system.md` — Memory & knowledge architecture
- `technical-spec.md` — Technical implementation details

Read these before making architectural changes.
