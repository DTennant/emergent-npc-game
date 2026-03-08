import Phaser from 'phaser';
import { GameState } from '../world/GameState';
import { NPC_PERSONAS } from '../npc/personas';
import { ITEMS } from '../inventory/types';
import { BUILDING_INTERIORS } from '../buildings/BuildingData';
import { EventBus, Events } from '../world/EventBus';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

interface DebugAPI {
  help(): void;
  scenes(): { key: string; active: boolean; visible: boolean }[];
  state(): Record<string, unknown>;
  tp(x: number, y: number): void;
  tpTo(location: string): void;
  locations(): void;
  give(itemId: string, qty?: number): void;
  items(): void;
  setTrust(npcName: string, value: number): void;
  setFamiliarity(npcName: string, value: number): void;
  npcInfo(npcName?: string): void;
  heal(): void;
  god(): void;
  gold(amount: number): void;
  enterBuilding(buildingId: string): void;
  buildings(): void;
  advanceDay(days?: number): void;
  quest(): Record<string, unknown>;
  completeQuest(): void;
  fps(): number;
  flags(): Record<string, unknown>;
  inventory(): void;
  save(): void;
  notify(msg: string): void;
}

const TELEPORT_LOCATIONS: Record<string, { x: number; y: number; scene?: string }> = {
  spawn: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
  forge: { x: 368, y: 350 },
  inn: { x: 704, y: 350 },
  market: { x: 592, y: 520 },
  farm: { x: 1024, y: 750 },
  guard: { x: 160, y: 620 },
  herbs: { x: 800, y: 220 },
  woods_entrance: { x: GAME_WIDTH - 40, y: GAME_HEIGHT / 2 },
  shrine: { x: 200, y: 200 },
};

export class DebugManager {
  private game: Phaser.Game;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.expose();
    console.log('%c[DEBUG] Debug tools loaded. Type __DEBUG__.help() for commands.', 'color: #44ff88; font-weight: bold');
  }

  private expose(): void {
    const api: DebugAPI = {
      help: () => this.printHelp(),
      scenes: () => this.getScenes(),
      state: () => this.getState(),
      tp: (x, y) => this.teleport(x, y),
      tpTo: (loc) => this.teleportTo(loc),
      locations: () => this.printLocations(),
      give: (id, qty) => this.giveItem(id, qty),
      items: () => this.printItems(),
      setTrust: (name, val) => this.setNPCTrust(name, val),
      setFamiliarity: (name, val) => this.setNPCFamiliarity(name, val),
      npcInfo: (name) => this.printNPCInfo(name),
      heal: () => this.healPlayer(),
      god: () => this.godMode(),
      gold: (amt) => this.giveGold(amt),
      enterBuilding: (id) => this.enterBuildingById(id),
      buildings: () => this.printBuildings(),
      advanceDay: (days) => this.advanceDays(days),
      quest: () => this.getQuestState(),
      completeQuest: () => this.completeAllQuests(),
      fps: () => this.getFPS(),
      flags: () => this.getSceneFlags(),
      inventory: () => this.printInventory(),
      save: () => this.forceSave(),
      notify: (msg) => EventBus.emit(Events.SHOW_NOTIFICATION, { message: msg }),
    };
    (window as unknown as Record<string, unknown>).__DEBUG__ = api;
  }

  private printHelp(): void {
    const cmds = [
      ['__DEBUG__.scenes()', 'List all scenes with active/visible status'],
      ['__DEBUG__.state()', 'Get full game state summary'],
      ['__DEBUG__.flags()', 'Get scene state flags (transitioning, inDialogue, etc.)'],
      ['__DEBUG__.tp(x, y)', 'Teleport player to coordinates'],
      ['__DEBUG__.tpTo("inn")', 'Teleport to named location'],
      ['__DEBUG__.locations()', 'List all teleport locations'],
      ['__DEBUG__.give("iron_sword")', 'Give item to player (optional qty)'],
      ['__DEBUG__.items()', 'List all available item IDs'],
      ['__DEBUG__.gold(500)', 'Give gold'],
      ['__DEBUG__.inventory()', 'Print current inventory'],
      ['__DEBUG__.setTrust("rose", 1.0)', 'Set NPC trust (0-1)'],
      ['__DEBUG__.setFamiliarity("rose", 1.0)', 'Set NPC familiarity (0-1)'],
      ['__DEBUG__.npcInfo()', 'Print all NPC states (or specify name)'],
      ['__DEBUG__.heal()', 'Fully heal player'],
      ['__DEBUG__.god()', 'Give all items + max trust + heal'],
      ['__DEBUG__.enterBuilding("inn")', 'Enter a building by ID'],
      ['__DEBUG__.buildings()', 'List all building IDs'],
      ['__DEBUG__.advanceDay(3)', 'Advance game time by N days'],
      ['__DEBUG__.quest()', 'Get quest/storyline state'],
      ['__DEBUG__.completeQuest()', 'Complete all quest objectives'],
      ['__DEBUG__.fps()', 'Get current FPS'],
      ['__DEBUG__.save()', 'Force save game'],
      ['__DEBUG__.notify("msg")', 'Show in-game notification'],
    ];
    console.log('%c=== Debug Commands ===', 'color: #ffd700; font-size: 14px; font-weight: bold');
    for (const [cmd, desc] of cmds) {
      console.log(`%c${cmd}%c — ${desc}`, 'color: #44ff88', 'color: #cccccc');
    }
  }

  private getActiveScene(): Phaser.Scene | null {
    const priorities = ['WorldScene', 'WoodsScene', 'DungeonScene', 'BuildingInteriorScene'];
    for (const key of priorities) {
      const scene = this.game.scene.getScene(key);
      if (scene && scene.scene.isActive()) return scene;
    }
    return null;
  }

  private getScenes(): { key: string; active: boolean; visible: boolean }[] {
    return this.game.scene.scenes.map(s => ({
      key: s.scene.key,
      active: s.scene.isActive(),
      visible: s.scene.isVisible(),
    }));
  }

  private getState(): Record<string, unknown> {
    const scene = this.getActiveScene();
    if (!scene) return { error: 'No active game scene' };
    const gs = GameState.get(scene);
    const player = (scene as unknown as Record<string, Phaser.Physics.Arcade.Sprite>).player;
    return {
      activeScene: scene.scene.key,
      zone: gs.currentZone,
      day: gs.worldState.getDay(),
      time: gs.worldState.getTimeString(),
      playerPos: player ? { x: Math.round(player.x), y: Math.round(player.y) } : null,
      inventorySlots: gs.inventory.getItems().length,
      equippedWeapon: gs.inventory.getEquipped('weapon'),
      blightAwareness: gs.storylineManager.blightAwareness,
      runestones: gs.storylineManager.getRunestoneCount(),
      shrineActivated: gs.storylineManager.shrineActivated,
    };
  }

  private getSceneFlags(): Record<string, unknown> {
    const scene = this.getActiveScene();
    if (!scene) return { error: 'No active game scene' };
    const s = scene as unknown as Record<string, unknown>;
    return {
      scene: scene.scene.key,
      transitioning: s.transitioning ?? 'n/a',
      inDialogue: s.inDialogue ?? 'n/a',
      inInventory: s.inInventory ?? 'n/a',
      inCrafting: s.inCrafting ?? 'n/a',
      inTrading: s.inTrading ?? 'n/a',
      cleanedUp: s.cleanedUp ?? 'n/a',
    };
  }

  private teleport(x: number, y: number): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const player = (scene as unknown as Record<string, Phaser.Physics.Arcade.Sprite>).player;
    if (!player) { console.warn('[DEBUG] No player in current scene'); return; }
    player.setPosition(x, y);
    console.log(`[DEBUG] Teleported to (${x}, ${y})`);
  }

  private teleportTo(location: string): void {
    const loc = TELEPORT_LOCATIONS[location.toLowerCase()];
    if (!loc) {
      console.warn(`[DEBUG] Unknown location "${location}". Use __DEBUG__.locations() to see options.`);
      return;
    }
    this.teleport(loc.x, loc.y);
  }

  private printLocations(): void {
    console.log('%c=== Teleport Locations ===', 'color: #ffd700; font-weight: bold');
    for (const [name, pos] of Object.entries(TELEPORT_LOCATIONS)) {
      console.log(`  %c${name}%c → (${pos.x}, ${pos.y})`, 'color: #44ff88', 'color: #cccccc');
    }
    console.log('Usage: __DEBUG__.tpTo("inn")');
  }

  private giveItem(itemId: string, qty = 1): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const def = ITEMS[itemId];
    if (!def) {
      console.warn(`[DEBUG] Unknown item "${itemId}". Use __DEBUG__.items() to see options.`);
      return;
    }
    const gs = GameState.get(scene);
    const success = gs.inventory.addItem(itemId, qty);
    if (success) {
      console.log(`[DEBUG] Gave ${qty}x ${def.name}`);
    } else {
      console.warn(`[DEBUG] Failed to add ${def.name} — inventory may be full`);
    }
  }

  private printItems(): void {
    console.log('%c=== Available Items ===', 'color: #ffd700; font-weight: bold');
    const byType: Record<string, string[]> = {};
    for (const [id, def] of Object.entries(ITEMS)) {
      const type = def.type;
      if (!byType[type]) byType[type] = [];
      byType[type].push(`${id} (${def.name})`);
    }
    for (const [type, items] of Object.entries(byType)) {
      console.log(`%c[${type}]`, 'color: #ffcc00; font-weight: bold');
      for (const item of items) {
        console.log(`  ${item}`);
      }
    }
  }

  private resolveNPCName(name: string): string | null {
    const lower = name.toLowerCase();
    const persona = NPC_PERSONAS.find(p =>
      p.name.toLowerCase() === lower ||
      p.id.toLowerCase() === lower ||
      p.id.toLowerCase().includes(lower)
    );
    return persona?.id ?? null;
  }

  private setNPCTrust(npcName: string, value: number): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const npcId = this.resolveNPCName(npcName);
    if (!npcId) { console.warn(`[DEBUG] Unknown NPC "${npcName}"`); return; }

    const npcs = (scene as unknown as Record<string, NPCLike[]>).npcs;
    if (npcs) {
      const npc = npcs.find((n: NPCLike) => n.persona.id === npcId);
      if (npc) {
        const rel = npc.memory.getRelationship('player');
        const delta = value - rel.trust;
        npc.memory.updateRelationship('player', { trustDelta: delta });
        console.log(`[DEBUG] Set ${npc.persona.name} trust to ${value}`);
        return;
      }
    }

    const gs = GameState.get(scene);
    const saved = gs.npcData.get(npcId);
    if (saved) {
      const social = saved.memory.social;
      if (!social.player) {
        social.player = { targetId: 'player', trust: value, affection: 0.3, familiarity: 0, notes: [], lastInteraction: 0 };
      } else {
        social.player.trust = value;
      }
      console.log(`[DEBUG] Set ${npcId} trust to ${value} (via save data)`);
    } else {
      console.warn(`[DEBUG] NPC ${npcId} not found in scene or save data`);
    }
  }

  private setNPCFamiliarity(npcName: string, value: number): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const npcId = this.resolveNPCName(npcName);
    if (!npcId) { console.warn(`[DEBUG] Unknown NPC "${npcName}"`); return; }

    const npcs = (scene as unknown as Record<string, NPCLike[]>).npcs;
    if (npcs) {
      const npc = npcs.find((n: NPCLike) => n.persona.id === npcId);
      if (npc) {
        const rel = npc.memory.getRelationship('player');
        rel.familiarity = Math.max(0, Math.min(1, value));
        console.log(`[DEBUG] Set ${npc.persona.name} familiarity to ${value}`);
        return;
      }
    }
    console.warn(`[DEBUG] NPC ${npcId} not found in active scene`);
  }

  private printNPCInfo(npcName?: string): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }

    const npcs = (scene as unknown as Record<string, NPCLike[]>).npcs;
    if (!npcs || !Array.isArray(npcs)) {
      console.log('[DEBUG] No NPCs in current scene');
      return;
    }

    const targets = npcName
      ? npcs.filter((n: NPCLike) => n.persona.name.toLowerCase() === npcName.toLowerCase() || n.persona.id.includes(npcName.toLowerCase()))
      : npcs;

    console.log('%c=== NPC Info ===', 'color: #ffd700; font-weight: bold');
    for (const npc of targets) {
      const rel = npc.memory.getRelationship('player');
      console.log(
        `%c${npc.persona.name}%c (${npc.persona.role}) — ` +
        `trust: ${rel.trust.toFixed(2)}, ` +
        `affection: ${rel.affection.toFixed(2)}, ` +
        `familiarity: ${rel.familiarity.toFixed(2)}, ` +
        `pos: (${Math.round(npc.sprite.x)}, ${Math.round(npc.sprite.y)})`,
        'color: #44ff88; font-weight: bold',
        'color: #cccccc'
      );
    }
  }

  private healPlayer(): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const cs = (scene as unknown as Record<string, { resetHealth: () => void }>).combatSystem;
    if (cs) {
      cs.resetHealth();
      console.log('[DEBUG] Player fully healed');
    } else {
      console.warn('[DEBUG] No combat system in current scene');
    }
  }

  private godMode(): void {
    this.healPlayer();
    this.giveItem('enchanted_blade', 1);
    this.giveItem('iron_shield', 1);
    this.giveItem('leather_armor', 1);
    this.giveItem('lantern', 1);
    this.giveItem('rope', 1);
    this.giveItem('health_potion', 5);
    this.giveItem('blight_ward', 3);
    this.giveItem('provisions', 10);
    this.giveGold(9999);

    for (const persona of NPC_PERSONAS) {
      this.setNPCTrust(persona.name, 1.0);
      this.setNPCFamiliarity(persona.name, 1.0);
    }
    console.log('%c[DEBUG] GOD MODE ACTIVATED — All items, max trust, full health', 'color: #ff4444; font-weight: bold; font-size: 14px');
  }

  private giveGold(amount: number): void {
    this.giveItem('gold', amount);
  }

  private enterBuildingById(buildingId: string): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const building = BUILDING_INTERIORS.find(b => b.id === buildingId);
    if (!building) {
      console.warn(`[DEBUG] Unknown building "${buildingId}". Use __DEBUG__.buildings() to see options.`);
      return;
    }
    const player = (scene as unknown as Record<string, Phaser.Physics.Arcade.Sprite>).player;
    scene.scene.start('BuildingInteriorScene', {
      buildingId: building.id,
      returnScene: scene.scene.key,
      returnX: player?.x ?? GAME_WIDTH / 2,
      returnY: player?.y ?? GAME_HEIGHT / 2,
    });
    console.log(`[DEBUG] Entering ${building.name}`);
  }

  private printBuildings(): void {
    console.log('%c=== Buildings ===', 'color: #ffd700; font-weight: bold');
    for (const b of BUILDING_INTERIORS) {
      console.log(`  %c${b.id}%c — ${b.name} (NPC: ${b.npcId})`, 'color: #44ff88', 'color: #cccccc');
    }
  }

  private advanceDays(days = 1): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const gs = GameState.get(scene);
    const msPerDay = 120000;
    gs.worldState.update(days * msPerDay);
    console.log(`[DEBUG] Advanced ${days} day(s). Now Day ${gs.worldState.getDay()}, ${gs.worldState.getTimeString()}`);
  }

  private getQuestState(): Record<string, unknown> {
    const scene = this.getActiveScene();
    if (!scene) return { error: 'No active game scene' };
    const gs = GameState.get(scene);
    return {
      blightAwareness: gs.storylineManager.blightAwareness,
      shrineActivated: gs.storylineManager.shrineActivated,
      runestones: gs.storylineManager.runestoneStatus,
      runestoneCount: gs.storylineManager.getRunestoneCount(),
      canActivateShrine: gs.storylineManager.canActivateShrine(),
    };
  }

  private completeAllQuests(): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const gs = GameState.get(scene);
    gs.storylineManager.discoverBlight();
    for (const dungeonId of ['forest_cave', 'abandoned_mine', 'ruined_tower']) {
      gs.storylineManager.discoverDungeon(dungeonId);
      gs.storylineManager.markNPCHelped(dungeonId);
      gs.storylineManager.clearDungeon(dungeonId);
      gs.storylineManager.obtainRunestone(dungeonId);
    }
    this.giveItem('runestone_forest', 1);
    this.giveItem('runestone_mine', 1);
    this.giveItem('runestone_tower', 1);
    console.log('[DEBUG] All quests completed. Bring runestones to the Shrine of Dawn.');
  }

  private getFPS(): number {
    return Math.round(this.game.loop.actualFps);
  }

  private printInventory(): void {
    const scene = this.getActiveScene();
    if (!scene) { console.warn('[DEBUG] No active game scene'); return; }
    const gs = GameState.get(scene);
    const items = gs.inventory.getItems();
    const equipped = gs.inventory.getEquippedSlots();
    console.log('%c=== Inventory ===', 'color: #ffd700; font-weight: bold');
    if (items.length === 0) {
      console.log('  (empty)');
    }
    for (const slot of items) {
      const def = ITEMS[slot.itemId];
      const name = def?.name ?? slot.itemId;
      console.log(`  ${name} x${slot.quantity}`);
    }
    console.log('%cEquipped:', 'color: #ffcc00');
    for (const [slot, id] of Object.entries(equipped)) {
      const name = id ? (ITEMS[id]?.name ?? id) : '(none)';
      console.log(`  ${slot}: ${name}`);
    }
  }

  private forceSave(): void {
    EventBus.emit(Events.SHOW_NOTIFICATION, { message: 'Game saved (debug)' });
    const scene = this.getActiveScene();
    if (!scene) return;
    const saveFn = (scene as unknown as Record<string, () => void>).saveGame;
    if (typeof saveFn === 'function') {
      saveFn.call(scene);
      console.log('[DEBUG] Game saved');
    } else {
      console.warn('[DEBUG] No saveGame method on current scene');
    }
  }
}

interface NPCLike {
  persona: { id: string; name: string; role: string };
  memory: {
    getRelationship(targetId: string): { trust: number; affection: number; familiarity: number };
    updateRelationship(targetId: string, changes: { trustDelta?: number }): void;
  };
  sprite: { x: number; y: number };
}
