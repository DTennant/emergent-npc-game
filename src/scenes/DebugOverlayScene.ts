import Phaser from 'phaser';
import { GameState } from '../world/GameState';
import { ITEMS } from '../inventory/types';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

const TELEPORT_KEYS: { key: string; label: string; x: number; y: number }[] = [
  { key: 'ONE', label: '1: Spawn', x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
  { key: 'TWO', label: '2: Forge', x: 368, y: 350 },
  { key: 'THREE', label: '3: Inn', x: 704, y: 350 },
  { key: 'FOUR', label: '4: Market', x: 592, y: 520 },
  { key: 'FIVE', label: '5: Farm', x: 1024, y: 750 },
  { key: 'SIX', label: '6: Guard', x: 160, y: 620 },
  { key: 'SEVEN', label: '7: Herbs', x: 800, y: 220 },
  { key: 'EIGHT', label: '8: Woods', x: GAME_WIDTH - 40, y: GAME_HEIGHT / 2 },
  { key: 'NINE', label: '9: Shrine', x: 640, y: 96 },
];

interface NPCLike {
  persona: { id: string; name: string; role: string };
  memory: {
    getRelationship(targetId: string): { trust: number; affection: number; familiarity: number };
  };
  sprite: { x: number; y: number };
  isInDialogue: boolean;
}

export class DebugOverlayScene extends Phaser.Scene {
  private debugText!: Phaser.GameObjects.Text;
  private bgRect!: Phaser.GameObjects.Rectangle;
  private visible = false;
  private f1Key!: Phaser.Input.Keyboard.Key;
  private teleportKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super({ key: 'DebugOverlayScene' });
  }

  create(): void {
    this.bgRect = this.add.rectangle(5, 5, 340, 400, 0x000000, 0.75);
    this.bgRect.setOrigin(0, 0);
    this.bgRect.setDepth(999);
    this.bgRect.setScrollFactor(0);
    this.bgRect.setVisible(false);

    this.debugText = this.add.text(10, 10, '', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#44ff88',
      lineSpacing: 2,
      resolution: window.devicePixelRatio,
    });
    this.debugText.setDepth(1000);
    this.debugText.setScrollFactor(0);
    this.debugText.setVisible(false);

    this.f1Key = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    this.f1Key.on('down', () => this.toggleOverlay());

    for (const tk of TELEPORT_KEYS) {
      const key = this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes[tk.key as keyof typeof Phaser.Input.Keyboard.KeyCodes]
      );
      key.on('down', () => {
        if (!this.visible) return;
        this.teleportPlayer(tk.x, tk.y, tk.label);
      });
      this.teleportKeys.push(key);
    }
  }

  update(): void {
    if (!this.visible) return;
    this.debugText.setText(this.buildDebugText());
    const bounds = this.debugText.getBounds();
    this.bgRect.setSize(
      Math.max(340, bounds.width + 16),
      bounds.height + 16
    );
  }

  private toggleOverlay(): void {
    this.visible = !this.visible;
    this.debugText.setVisible(this.visible);
    this.bgRect.setVisible(this.visible);
  }

  private getGameScene(): Phaser.Scene | null {
    const priorities = ['WorldScene', 'WoodsScene', 'DungeonScene', 'BuildingInteriorScene'];
    for (const key of priorities) {
      const scene = this.scene.get(key);
      if (scene && scene.scene.isActive()) return scene;
    }
    return null;
  }

  private buildDebugText(): string {
    const lines: string[] = [];
    const fps = Math.round(this.game.loop.actualFps);
    lines.push(`--- DEBUG (F1 toggle) --- FPS: ${fps}`);
    lines.push('');

    const activeScenes = this.game.scene.scenes
      .filter(s => s.scene.isActive())
      .map(s => s.scene.key);
    lines.push(`Scenes: ${activeScenes.join(', ')}`);

    const gameScene = this.getGameScene();
    if (!gameScene) {
      lines.push('No active game scene');
      return lines.join('\n');
    }

    const gs = GameState.get(gameScene);
    const s = gameScene as unknown as Record<string, unknown>;
    const player = s.player as Phaser.Physics.Arcade.Sprite | undefined;

    lines.push(`Zone: ${gs.currentZone} | Scene: ${gameScene.scene.key}`);
    lines.push(`Day ${gs.worldState.getDay()} | ${gs.worldState.getTimeString()}`);
    lines.push('');

    if (player) {
      const vx = Math.round((player.body as Phaser.Physics.Arcade.Body)?.velocity?.x ?? 0);
      const vy = Math.round((player.body as Phaser.Physics.Arcade.Body)?.velocity?.y ?? 0);
      lines.push(`Player: (${Math.round(player.x)}, ${Math.round(player.y)}) vel:(${vx},${vy})`);
    }

    const flags = ['transitioning', 'inDialogue', 'inInventory', 'inCrafting', 'inTrading', 'cleanedUp'];
    const activeFlags = flags.filter(f => s[f] === true);
    lines.push(`Flags: ${activeFlags.length > 0 ? activeFlags.join(', ') : '(none)'}`);
    lines.push('');

    const weapon = gs.inventory.getEquipped('weapon');
    const weaponName = weapon ? (ITEMS[weapon]?.name ?? weapon) : 'none';
    lines.push(`Weapon: ${weaponName} | Items: ${gs.inventory.getItems().length}`);
    const goldSlot = gs.inventory.getItems().find(i => i.itemId === 'gold');
    lines.push(`Gold: ${goldSlot?.quantity ?? 0}`);

    const cs = s.combatSystem as { getHealth?: () => number; getMaxHealth?: () => number } | undefined;
    if (cs?.getHealth) {
      lines.push(`HP: ${cs.getHealth()}/${cs.getMaxHealth?.() ?? '?'}`);
    }
    lines.push('');

    lines.push(`Quest: ${gs.storylineManager.blightAwareness ? 'Blight known' : 'Exploring'}`);
    lines.push(`Runestones: ${gs.storylineManager.getRunestoneCount()}/3`);
    lines.push('');

    const npcs = s.npcs as NPCLike[] | undefined;
    if (npcs && Array.isArray(npcs)) {
      lines.push(`--- NPCs (${npcs.length}) ---`);
      for (const npc of npcs) {
        const rel = npc.memory.getRelationship('player');
        const dlg = npc.isInDialogue ? ' [TALKING]' : '';
        lines.push(
          `${npc.persona.name}: T:${rel.trust.toFixed(1)} A:${rel.affection.toFixed(1)} F:${rel.familiarity.toFixed(1)}${dlg}`
        );
      }
    }

    const singleNpc = s.npc as NPCLike | null | undefined;
    if (singleNpc && !npcs) {
      lines.push('--- NPC ---');
      const rel = singleNpc.memory.getRelationship('player');
      lines.push(
        `${singleNpc.persona.name}: T:${rel.trust.toFixed(1)} A:${rel.affection.toFixed(1)} F:${rel.familiarity.toFixed(1)}`
      );
    }

    lines.push('');
    lines.push('--- Teleport (press key while open) ---');
    for (const tk of TELEPORT_KEYS) {
      lines.push(`  ${tk.label}`);
    }

    return lines.join('\n');
  }

  private teleportPlayer(x: number, y: number, label: string): void {
    const gameScene = this.getGameScene();
    if (!gameScene) return;
    const player = (gameScene as unknown as Record<string, Phaser.Physics.Arcade.Sprite>).player;
    if (!player) return;
    player.setPosition(x, y);
    console.log(`[DEBUG] Teleported to ${label} (${x}, ${y})`);
  }

  shutdown(): void {
    if (this.f1Key) this.f1Key.removeAllListeners();
    for (const key of this.teleportKeys) {
      key.removeAllListeners();
    }
    this.teleportKeys = [];
  }
}
