import Phaser from 'phaser';
import { NPC } from '../npc/NPC';
import { NPC_PERSONAS } from '../npc/personas';
import { GossipSystem } from '../npc/GossipSystem';
import { SaveManager } from '../persistence/SaveManager';
import { BlightSystem } from '../world/BlightSystem';
import { EventBus, Events } from '../world/EventBus';
import { GameState, NPCSaveState } from '../world/GameState';
import { GossipPacket } from '../memory/types';
import { TextureKeys } from '../assets/keys';
import { AldricJournal, JOURNAL_PAGES } from '../story/AldricJournal';
import { CombatSystem } from '../combat/CombatSystem';
import { HealthBar } from '../combat/HealthBar';
import { NPC_SHOPS } from '../crafting/TradeData';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  PLAYER_SPEED,
  INTERACTION_DISTANCE,
  COLORS,
  BUILDING_COLLISION_PADDING,
  PLAYER_MAX_HEALTH,
  INVINCIBILITY_MS,
  fs,
} from '../config';

interface ItemPickupDef {
  itemId: string;
  quantity?: number;
  x: number;
  y: number;
  label: string;
}

interface ItemPickupInstance {
  def: ItemPickupDef;
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface WorldSceneInitData {
  spawnX?: number;
  spawnY?: number;
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    I: Phaser.Input.Keyboard.Key;
  };
  private npcs: NPC[] = [];
  private inDialogue = false;
  private inInventory = false;
  private inCrafting = false;
  private inTrading = false;
  private transitioning = false;
  private interactionPrompt!: Phaser.GameObjects.Text;
  private nearestNPC: NPC | null = null;
  private gossipSystem!: GossipSystem;
  private gossipTracker: Map<string, Set<string>> = new Map();
  private buildingGroup!: Phaser.Physics.Arcade.StaticGroup;
  private npcGroup!: Phaser.Physics.Arcade.Group;
  private combatSystem!: CombatSystem;
  private playerHealthBar!: HealthBar;
  private playerFacing: string = 'down';
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private blightSystem!: BlightSystem;
  private journalSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private shrineZone!: Phaser.GameObjects.Rectangle;
  private shrineLabel!: Phaser.GameObjects.Text;
  private itemPickups: ItemPickupInstance[] = [];
  private spawnX = GAME_WIDTH / 2;
  private spawnY = GAME_HEIGHT / 2;
  private innMarker: Phaser.GameObjects.Text | null = null;
  private innMarkerListener: ((data: { npc: { persona: { id: string; name: string } } }) => void) | null = null;

  constructor() {
    super({ key: 'WorldScene' });
  }

  init(data?: WorldSceneInitData): void {
    this.spawnX = data?.spawnX ?? GAME_WIDTH / 2;
    this.spawnY = data?.spawnY ?? GAME_HEIGHT / 2;
  }

  create(): void {
    const gs = GameState.get(this);
    gs.currentZone = 'village';

    this.createWorld();
    this.createJournalPages();

    this.blightSystem = new BlightSystem(this);

    this.createShrineOfDawn();

    this.player = this.physics.add.sprite(this.spawnX, this.spawnY, TextureKeys.PLAYER);
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);

    this.playerLabel = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE * 0.7,
      'You',
      {
        fontSize: fs(24),
        color: '#88bbff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      }
    );
    this.playerLabel.setOrigin(0.5, 1);
    this.playerLabel.setDepth(11);

    this.npcGroup = this.physics.add.group();

    for (const persona of NPC_PERSONAS) {
      const npc = new NPC(this, persona);
      this.npcs.push(npc);
      this.npcGroup.add(npc.sprite);
    }

    this.restoreNPCState();

    this.gossipSystem = new GossipSystem(this.npcs);

    this.physics.add.collider(this.player, this.buildingGroup);
    this.physics.add.collider(this.npcGroup, this.buildingGroup);

    this.restoreFromSave();

    this.createItemPickups();

    EventBus.on(Events.DAY_CHANGE, this.onDayChange, this);
    EventBus.on(Events.DIALOGUE_END, this.onDialogueEnd, this);
    EventBus.on(Events.NPC_GOSSIP, this.onNPCGossip, this);
    EventBus.on(Events.LLM_CONFIG_CHANGED, this.onLLMConfigChanged, this);
    EventBus.on(Events.ITEM_ACQUIRED, this.onItemAcquired, this);
    EventBus.on(Events.PLAYER_DIED, this.onPlayerDied, this);

    this.combatSystem = new CombatSystem(this, this.player);
    this.playerHealthBar = new HealthBar(
      this,
      this.player.x,
      this.player.y - TILE_SIZE,
      TILE_SIZE,
      4,
      PLAYER_MAX_HEALTH
    );

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      I: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I),
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.interactionPrompt = this.add.text(0, 0, '[E] Talk', {
      fontSize: fs(26),
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
      resolution: window.devicePixelRatio,
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setDepth(20);
    this.interactionPrompt.setVisible(false);

    this.scene.launch('HUDScene', { worldState: gs.worldState, llmClient: gs.llmClient });

    this.wasd.E.on('down', () => {
      if (this.inDialogue || this.transitioning) return;
      if (this.tryPickupItem()) return;
      if (this.nearestNPC) {
        this.startDialogue(this.nearestNPC);
        return;
      }
      if (this.isNearShrine()) {
        this.tryActivateShrine();
        return;
      }
      this.tryPickupJournalPage();
    });

    this.wasd.I.on('down', () => {
      if (this.inDialogue || this.transitioning) return;
      const gs2 = GameState.get(this);
      if (this.inInventory) {
        this.scene.stop('InventoryScene');
        this.inInventory = false;
      } else {
        this.inInventory = true;
        this.scene.launch('InventoryScene', { inventory: gs2.inventory, combatSystem: this.combatSystem });
        this.scene.get('InventoryScene').events.once('shutdown', () => {
          this.inInventory = false;
        });
      }
    });

    this.input.keyboard!.addKey('C').on('down', () => {
      if (this.inDialogue || this.transitioning || this.inTrading || this.inInventory) return;
      if (this.inCrafting) {
        this.scene.stop('CraftingScene');
        this.inCrafting = false;
        return;
      }
      this.openCrafting();
    });

    this.input.keyboard!.addKey('T').on('down', () => {
      if (this.inDialogue || this.transitioning || this.inCrafting || this.inInventory) return;
      if (this.inTrading) {
        this.scene.stop('TradeScene');
        this.inTrading = false;
        return;
      }
      if (this.nearestNPC) {
        this.openTrade(this.nearestNPC);
      }
    });

    this.spaceKey.on('down', () => {
      if (this.inDialogue || this.transitioning) return;
      this.handlePlayerAttack();
    });

    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(400);

    this.createInnMarker();
    this.showOpeningStory();
  }

  update(_time: number, delta: number): void {
    if (this.inDialogue || this.transitioning || this.inCrafting || this.inTrading) return;

    const gs = GameState.get(this);
    gs.worldState.update(delta);

    this.handlePlayerMovement();

    for (const npc of this.npcs) {
      npc.update(delta, gs.worldState);
    }

    this.gossipSystem.update(delta, gs.worldState.getDay());

    this.checkNPCProximity();
    this.checkZoneExit();

    this.playerLabel.setPosition(this.player.x, this.player.y - TILE_SIZE * 0.7);
    this.playerHealthBar.setPosition(this.player.x, this.player.y - TILE_SIZE);
    this.playerHealthBar.setHealth(this.combatSystem.getHealth());
  }

  shutdown(): void {
    this.cleanupEvents();
  }

  private cleanupEvents(): void {
    EventBus.off(Events.DAY_CHANGE, this.onDayChange, this);
    EventBus.off(Events.DIALOGUE_END, this.onDialogueEnd, this);
    EventBus.off(Events.NPC_GOSSIP, this.onNPCGossip, this);
    EventBus.off(Events.LLM_CONFIG_CHANGED, this.onLLMConfigChanged, this);
    EventBus.off(Events.ITEM_ACQUIRED, this.onItemAcquired, this);
    EventBus.off(Events.PLAYER_DIED, this.onPlayerDied, this);
    this.destroyInnMarker();
  }

  private onDayChange(data: { day: number }): void {
    this.blightSystem.update(data.day);
    this.updateBlightWorldState();
    this.saveGame();
  }

  private onDialogueEnd(): void {
    this.saveGame();
  }

  private onNPCGossip(packet: GossipPacket): void {
    this.trackGossipForPromotion(packet);
  }

  private onLLMConfigChanged(): void {
    const gs = GameState.get(this);
    gs.llmClient.reloadConfig();
  }

  private onItemAcquired(data: { itemId: string }): void {
    const gs = GameState.get(this);
    if (data.itemId.startsWith('aldric_journal_') && !gs.storylineManager.blightAwareness) {
      gs.storylineManager.discoverBlight();
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: 'You sense the truth about the Blight...',
      });
    }

    const runestoneMap: Record<string, string> = {
      runestone_forest: 'forest_cave',
      runestone_mine: 'abandoned_mine',
      runestone_tower: 'ruined_tower',
    };
    const dungeonId = runestoneMap[data.itemId];
    if (dungeonId) {
      gs.storylineManager.obtainRunestone(dungeonId);
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `Runestone obtained! (${gs.storylineManager.getRunestoneCount()}/3)`,
      });
    }
  }

  private onPlayerDied(): void {
    this.handlePlayerDeath();
  }

  private createWorld(): void {
    const gentleDominant = 'gentle_grass1';
    const gentleAccent = 'gentle_grass2';
    const hasGentle = this.textures.exists(gentleDominant);

    const grassTiles = ['tile_grass', 'tile_grass2', 'tile_grass3', 'tile_grass4'];
    const hasRpg = grassTiles.some((k) => this.textures.exists(k));

    for (let x = 0; x < GAME_WIDTH; x += TILE_SIZE) {
      for (let y = 0; y < GAME_HEIGHT; y += TILE_SIZE) {
        if (hasGentle) {
          const useAccent = Math.random() < 0.15;
          const tileKey = useAccent && this.textures.exists(gentleAccent) ? gentleAccent : gentleDominant;
          const tile = this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, tileKey);
          tile.setDepth(0);
        } else if (hasRpg) {
          const tileKey = grassTiles[Math.floor(Math.random() * grassTiles.length)];
          const tile = this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, tileKey);
          tile.setScale(2);
          tile.setDepth(0);
        } else {
          const shade = 0.9 + Math.random() * 0.2;
          const r = Math.floor(((COLORS.grass >> 16) & 0xff) * shade);
          const g = Math.floor(((COLORS.grass >> 8) & 0xff) * shade);
          const b = Math.floor((COLORS.grass & 0xff) * shade);
          const color = (r << 16) | (g << 8) | b;
          this.add.rectangle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, color).setDepth(0);
        }
      }
    }

    if (hasGentle) {
      this.addGentleDecoration();
    }

    this.buildingGroup = this.physics.add.staticGroup();

    const buildings = [
      { x: 368, y: 288, w: 80, h: 60, texture: TextureKeys.BUILDING_FORGE, label: '\u2692\uFE0F Forge' },
      { x: 704, y: 288, w: 90, h: 70, texture: TextureKeys.BUILDING_INN, label: '\uD83C\uDF7A Inn' },
      { x: 592, y: 464, w: 70, h: 50, texture: TextureKeys.BUILDING_MARKET, label: '\uD83D\uDED2 Shop' },
      { x: 1024, y: 688, w: 100, h: 60, texture: TextureKeys.BUILDING_FARM, label: '\uD83C\uDF3E Farm' },
      { x: 160, y: 560, w: 60, h: 50, texture: TextureKeys.BUILDING_GUARD, label: '\uD83D\uDEE1\uFE0F Guard' },
      { x: 800, y: 160, w: 70, h: 50, texture: TextureKeys.BUILDING_HERBS, label: '\uD83C\uDF3F Herbs' },
    ];

    for (const b of buildings) {
      const bldg = this.buildingGroup.create(b.x, b.y, b.texture) as Phaser.Physics.Arcade.Sprite;
      bldg.setDepth(1);
      const body = bldg.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(b.w * BUILDING_COLLISION_PADDING, b.h * BUILDING_COLLISION_PADDING);

      this.add
        .text(b.x, b.y - b.h / 2 - 8, b.label, {
          fontSize: fs(22),
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          resolution: window.devicePixelRatio,
        })
        .setOrigin(0.5)
        .setDepth(2);
    }

    const pathTiles = ['gentle_path1', 'gentle_path2', 'gentle_path3', 'gentle_path4'];
    const hasGentlePath = pathTiles.some((k) => this.textures.exists(k));

    const pathSegments = [
      { startX: 400, startY: 288, endX: 672, endY: 288 },
      { startX: 640, startY: 288, endX: 640, endY: 464 },
      { startX: 592, startY: 464, endX: 1024, endY: 464 },
      { startX: 320, startY: 368, endX: 320, endY: 560 },
      { startX: 800, startY: 160, endX: 800, endY: 288 },
    ];

    for (const seg of pathSegments) {
      if (hasGentlePath) {
        const dx = seg.endX - seg.startX;
        const dy = seg.endY - seg.startY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy)) / TILE_SIZE;
        for (let i = 0; i <= steps; i++) {
          const px = seg.startX + (dx / steps) * i;
          const py = seg.startY + (dy / steps) * i;
          const gridX = Math.floor(px / TILE_SIZE);
          const gridY = Math.floor(py / TILE_SIZE);
          const tileKey = pathTiles[(gridX + gridY) % 2 === 0 ? 0 : 1];
          this.add.image(px, py, tileKey).setDepth(0.5);
        }
      } else {
        const w = Math.max(12, Math.abs(seg.endX - seg.startX));
        const h = Math.max(12, Math.abs(seg.endY - seg.startY));
        const cx = (seg.startX + seg.endX) / 2;
        const cy = (seg.startY + seg.endY) / 2;
        this.add.rectangle(cx, cy, w, h, COLORS.path, 0.6).setDepth(0.5);
      }
    }

    this.add
      .text(GAME_WIDTH / 2, 20, '\uD83C\uDFD8\uFE0F Thornwick Village', {
        fontSize: fs(34),
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5)
      .setDepth(15);

    const exitHint = this.add.text(GAME_WIDTH - 10, GAME_HEIGHT / 2, '\u2192 Dark Woods', {
      fontSize: fs(24),
      color: '#aaffaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    exitHint.setOrigin(1, 0.5);
    exitHint.setDepth(15);
    this.tweens.add({
      targets: exitHint,
      alpha: { from: 0.4, to: 1.0 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });
  }

  private addGentleDecoration(): void {
    // Tree tiles form a 2-wide × 4-tall assembly (8 tiles per tree)
    // Row 0: gentle_tree1, gentle_tree5
    // Row 1: gentle_tree2, gentle_tree6
    // Row 2: gentle_tree3, gentle_tree7
    // Row 3: gentle_tree4, gentle_tree8
    const treeGrid = [
      ['gentle_tree1', 'gentle_tree5'],
      ['gentle_tree2', 'gentle_tree6'],
      ['gentle_tree3', 'gentle_tree7'],
      ['gentle_tree4', 'gentle_tree8'],
    ];
    const hasAllTrees = treeGrid.every((row) => row.every((k) => this.textures.exists(k)));

    if (hasAllTrees) {
      const treePositions = [
        { x: 48, y: 32 }, { x: 112, y: 64 },
        { x: 1200, y: 32 }, { x: 1200, y: 256 },
        { x: 48, y: 720 }, { x: 48, y: 800 },
        { x: 1200, y: 720 }, { x: 1200, y: 800 },
        { x: 480, y: 48 }, { x: 960, y: 48 },
      ];

      for (const pos of treePositions) {
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 2; col++) {
            const tile = this.add.image(pos.x + col * 32, pos.y + row * 32, treeGrid[row][col]);
            tile.setDepth(2);
          }
        }
      }
    }

    const flowerTiles = ['gentle_flower1', 'gentle_flower2', 'gentle_flower3'];
    const availableFlowers = flowerTiles.filter((k) => this.textures.exists(k));

    if (availableFlowers.length > 0) {
      const flowerPositions = [
        { x: 300, y: 200 }, { x: 750, y: 350 }, { x: 500, y: 600 },
      ];
      for (const pos of flowerPositions) {
        const key = availableFlowers[Math.floor(Math.random() * availableFlowers.length)];
        this.add.image(pos.x, pos.y, key).setDepth(0.5);
      }
    }

    if (this.textures.exists('gentle_water1') && this.textures.exists('gentle_water2')) {
      const pondX = 160;
      const pondY = 160;
      for (let dx = 0; dx < 3; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          const key = (dx + dy) % 2 === 0 ? 'gentle_water1' : 'gentle_water2';
          this.add.image(pondX + dx * 32, pondY + dy * 32, key).setDepth(0.5);
        }
      }
    }
  }

  private handlePlayerMovement(): void {
    let dx = 0;
    let dy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) dx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) dx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) dy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        this.playerFacing = dx > 0 ? 'right' : 'left';
      } else {
        this.playerFacing = dy > 0 ? 'down' : 'up';
      }

      const animKey = `${TextureKeys.PLAYER}_walk_${this.playerFacing}`;
      if (this.player.anims && this.player.anims.currentAnim?.key !== animKey) {
        this.player.anims.play(animKey, true);
      }
    } else {
      this.player.anims.stop();
      const dirFrameMap: Record<string, number> = { down: 0, left: 3, right: 6, up: 9 };
      this.player.setFrame(dirFrameMap[this.playerFacing] ?? 0);
    }

    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.player.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED);
  }

  private checkNPCProximity(): void {
    let closest: NPC | null = null;
    let closestDist = Infinity;

    for (const npc of this.npcs) {
      const dist = npc.distanceTo(this.player.x, this.player.y);
      if (dist < INTERACTION_DISTANCE && dist < closestDist) {
        closest = npc;
        closestDist = dist;
      }
    }

    this.nearestNPC = closest;

    if (closest) {
      this.interactionPrompt.setPosition(closest.sprite.x, closest.sprite.y - TILE_SIZE * 1.2);
      const hasShop = NPC_SHOPS[closest.persona.id] !== undefined;
      const tradeHint = hasShop ? '  [T] Trade' : '';
      this.interactionPrompt.setText(`[E] Talk to ${closest.persona.name}${tradeHint}`);
      this.interactionPrompt.setVisible(true);
    } else if (this.isNearShrine()) {
      this.interactionPrompt.setPosition(640, 61);
      this.interactionPrompt.setText('[E] Activate Shrine');
      this.interactionPrompt.setVisible(true);
    } else {
      const nearPage = this.getNearbyJournalPage();
      if (nearPage) {
        this.interactionPrompt.setPosition(nearPage.position.x, nearPage.position.y - 20);
        this.interactionPrompt.setText('[E] Pick up journal page');
        this.interactionPrompt.setVisible(true);
      } else {
        const nearItem = this.getNearbyItemPickup();
        if (nearItem) {
          this.interactionPrompt.setPosition(nearItem.def.x, nearItem.def.y - 24);
          this.interactionPrompt.setText(`[E] Pick up ${nearItem.def.label}`);
          this.interactionPrompt.setVisible(true);
        } else {
          this.interactionPrompt.setVisible(false);
        }
      }
    }
  }

  private checkZoneExit(): void {
    if (this.transitioning) return;
    if (this.player.x > GAME_WIDTH - 40) {
      this.player.setVelocity(0, 0);
      this.showZonePrompt('Enter the Dark Woods?', () => {
        this.saveNPCState();
        this.saveGame();
        this.cleanupEvents();
        this.scene.stop('HUDScene');
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(400, () => {
          this.scene.start('WoodsScene', {
            spawnX: 60,
            spawnY: this.player.y,
          });
        });
      });
    }
  }

  private showZonePrompt(message: string, onConfirm: () => void): void {
    this.transitioning = true;
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 150, 0x000000, 0.85);
    bg.setDepth(200);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, message, {
      fontSize: fs(38),
      color: '#ffffff',
      align: 'center',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(201);
    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, '[Y] Yes    [N] No', {
      fontSize: fs(30),
      color: '#aaaaaa',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(201);

    const yKey = this.input.keyboard!.addKey('Y');
    const nKey = this.input.keyboard!.addKey('N');

    const cleanup = () => {
      bg.destroy();
      text.destroy();
      hint.destroy();
      yKey.removeAllListeners();
      nKey.removeAllListeners();
      this.input.keyboard!.removeKey('Y');
      this.input.keyboard!.removeKey('N');
    };

    yKey.once('down', () => {
      cleanup();
      onConfirm();
    });
    nKey.once('down', () => {
      cleanup();
      this.transitioning = false;
      this.player.setPosition(GAME_WIDTH - 80, this.player.y);
    });
  }

  private saveNPCState(): void {
    const gs = GameState.get(this);
    for (const npc of this.npcs) {
      gs.npcData.set(npc.persona.id, {
        memory: npc.memory.toJSON() as NPCSaveState['memory'],
        goals: npc.goals.toJSON(),
        position: { x: npc.sprite.x, y: npc.sprite.y },
      });
    }
  }

  private restoreNPCState(): void {
    const gs = GameState.get(this);
    for (const npc of this.npcs) {
      const saved = gs.npcData.get(npc.persona.id);
      if (saved) {
        npc.memory.fromJSON(saved.memory);
        npc.goals.fromJSON(saved.goals);
        npc.sprite.setPosition(saved.position.x, saved.position.y);
        npc.nameTag.setPosition(saved.position.x, saved.position.y - TILE_SIZE * 0.7);
      }
    }
  }

  private createItemPickups(): void {
    const gs = GameState.get(this);
    const pickups: ItemPickupDef[] = [
      { itemId: 'wooden_sword', x: 1100, y: 480, label: 'Wooden Sword' },
      { itemId: 'health_potion', x: 680, y: 130, label: 'Health Potion' },
      { itemId: 'gold', quantity: 25, x: 450, y: 350, label: 'Gold (25)' },
      { itemId: 'wood', x: 200, y: 700, label: 'Wood' },
      { itemId: 'stone', x: 950, y: 200, label: 'Stone' },
      { itemId: 'plant_fiber', x: 350, y: 550, label: 'Plant Fiber' },
    ];

    for (const def of pickups) {
      if (gs.inventory.hasItem(def.itemId)) continue;

      const sprite = this.add.rectangle(def.x, def.y, 16, 16, 0xffdd44);
      sprite.setDepth(5);
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.5, to: 1.0 },
        scaleX: { from: 0.8, to: 1.2 },
        scaleY: { from: 0.8, to: 1.2 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });

      const label = this.add.text(def.x, def.y - 16, def.label, {
        fontSize: fs(20),
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      }).setOrigin(0.5).setDepth(6);

      this.itemPickups.push({ def, sprite, label });
    }
  }

  private getNearbyItemPickup(): ItemPickupInstance | null {
    for (const pickup of this.itemPickups) {
      const dx = this.player.x - pickup.def.x;
      const dy = this.player.y - pickup.def.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE) {
        return pickup;
      }
    }
    return null;
  }

  private tryPickupItem(): boolean {
    const gs = GameState.get(this);
    for (let i = this.itemPickups.length - 1; i >= 0; i--) {
      const pickup = this.itemPickups[i];
      const dx = this.player.x - pickup.def.x;
      const dy = this.player.y - pickup.def.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE) {
        gs.inventory.addItem(pickup.def.itemId, pickup.def.quantity ?? 1);
        this.tweens.killTweensOf(pickup.sprite);
        pickup.sprite.setVisible(false);
        pickup.sprite.destroy();
        pickup.label.setVisible(false);
        pickup.label.destroy();
        this.itemPickups.splice(i, 1);
        EventBus.emit(Events.SHOW_NOTIFICATION, { message: `Picked up: ${pickup.def.label}` });
        return true;
      }
    }
    return false;
  }

  private saveGame(): void {
    const gs = GameState.get(this);
    gs.worldState.blightSystemData = this.blightSystem.toJSON();
    gs.worldState.storylineData = gs.storylineManager.toJSON();
    SaveManager.save(
      gs.worldState,
      this.npcs,
      gs.inventory,
      { x: this.player.x, y: this.player.y },
      gs.currentZone
    );
  }

  private restoreFromSave(): void {
    const gs = GameState.get(this);
    const saveData = SaveManager.load();
    if (!saveData) return;

    gs.worldState.fromJSON(saveData.world);

    for (const npc of this.npcs) {
      const npcSave = saveData.npcs[npc.persona.id];
      if (npcSave) {
        npc.memory.fromJSON(npcSave.memory);
        if (npcSave.goals) {
          npc.goals.fromJSON(npcSave.goals);
        }
        npc.sprite.setPosition(npcSave.position.x, npcSave.position.y);
        npc.nameTag.setPosition(npcSave.position.x, npcSave.position.y - TILE_SIZE * 0.7);
      }
    }

    gs.inventory.fromJSON(saveData.inventory);

    if (saveData.world.blightSystem) {
      this.blightSystem.fromJSON(saveData.world.blightSystem);
    }

    if (saveData.world.storyline) {
      gs.storylineManager.fromJSON(saveData.world.storyline);
    }

    if (!this.spawnX || this.spawnX === GAME_WIDTH / 2) {
      this.player.setPosition(saveData.player.x, saveData.player.y);
      this.playerLabel.setPosition(saveData.player.x, saveData.player.y - TILE_SIZE * 0.7);
    }
  }

  private trackGossipForPromotion(packet: GossipPacket): void {
    const gs = GameState.get(this);
    const key = `${packet.subject}::${packet.content}`;
    const knowers = this.gossipTracker.get(key) ?? new Set<string>();
    knowers.add(packet.from);
    knowers.add(packet.to);
    this.gossipTracker.set(key, knowers);

    if (knowers.size >= 3) {
      gs.worldState.villageMemory.promoteFromGossip(
        packet.subject,
        packet.content,
        Array.from(knowers),
        gs.worldState.getDay()
      );
    }
  }

  private createJournalPages(): void {
    const gs = GameState.get(this);
    for (const page of JOURNAL_PAGES) {
      if (gs.aldricJournal.isDiscovered(page.id)) continue;

      const rect = this.add.rectangle(page.position.x, page.position.y, 12, 16, 0xffd700);
      rect.setDepth(3);
      this.tweens.add({
        targets: rect,
        alpha: { from: 0.6, to: 1.0 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.journalSprites.set(page.id, rect);
    }
  }

  private createShrineOfDawn(): void {
    this.shrineZone = this.add.rectangle(640, 96, 60, 40, 0xffd700, 0.3);
    this.shrineZone.setDepth(3);
    this.shrineZone.setStrokeStyle(2, 0xffd700);
    this.tweens.add({
      targets: this.shrineZone,
      alpha: { from: 0.2, to: 0.5 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.shrineLabel = this.add.text(640, 61, 'Shrine of Dawn', {
      fontSize: fs(22),
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.shrineLabel.setOrigin(0.5);
    this.shrineLabel.setDepth(4);
  }

  private isNearShrine(): boolean {
    const dx = this.player.x - 640;
    const dy = this.player.y - 96;
    return Math.abs(dx) < 35 && Math.abs(dy) < 25;
  }

  private tryActivateShrine(): void {
    if (!this.isNearShrine()) return;
    const gs = GameState.get(this);

    if (gs.storylineManager.shrineActivated) {
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: 'The Shrine of Dawn glows with peaceful light. The Blight is sealed.',
      });
      return;
    }

    if (gs.storylineManager.canActivateShrine()) {
      gs.storylineManager.activateShrine();
      this.blightSystem.seal();
      this.updateBlightWorldState();

      this.tweens.killTweensOf(this.shrineZone);
      this.shrineZone.setFillStyle(0xffd700, 0.8);
      this.shrineZone.setAlpha(1);

      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: 'The Shrine of Dawn blazes with golden light! The Blight is sealed forever!',
      });
    } else {
      const count = gs.storylineManager.getRunestoneCount();
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `You need all 3 Runestones to activate the Shrine. (${count}/3 found)`,
      });
    }
  }

  private getNearbyJournalPage(): typeof JOURNAL_PAGES[number] | null {
    const gs = GameState.get(this);
    for (const page of JOURNAL_PAGES) {
      if (gs.aldricJournal.isDiscovered(page.id)) continue;
      const dx = this.player.x - page.position.x;
      const dy = this.player.y - page.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE) {
        return page;
      }
    }
    return null;
  }

  private tryPickupJournalPage(): void {
    const gs = GameState.get(this);
    const page = this.getNearbyJournalPage();
    if (!page) return;

    gs.aldricJournal.discoverPage(page.id);
    gs.inventory.addItem(page.id);

    const sprite = this.journalSprites.get(page.id);
    if (sprite) {
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
      this.journalSprites.delete(page.id);
    }

    EventBus.emit(Events.SHOW_NOTIFICATION, { message: `Found: ${page.title}` });
  }

  private updateBlightWorldState(): void {
    const gs = GameState.get(this);
    const intensity = this.blightSystem.getIntensity();
    gs.worldState.village.blightIntensity = intensity;
    gs.worldState.village.safety = Math.max(0, 0.8 - intensity * 0.6);

    const blightFacts: string[] = [];
    if (intensity > 0.2) blightFacts.push('Dark tendrils creep from the Ancient Forest');
    if (intensity > 0.4) blightFacts.push('Corrupted wolves roam closer to the village');
    if (intensity > 0.6) blightFacts.push('The Blight visibly darkens the eastern sky');
    if (intensity > 0.8) blightFacts.push('Thornwick is in grave danger from the spreading darkness');

    gs.worldState.worldFacts = gs.worldState.worldFacts.filter(
      (f) =>
        f !== 'Dark tendrils creep from the Ancient Forest' &&
        f !== 'Corrupted wolves roam closer to the village' &&
        f !== 'The Blight visibly darkens the eastern sky' &&
        f !== 'Thornwick is in grave danger from the spreading darkness'
    );
    gs.worldState.worldFacts.push(...blightFacts);
  }

  private handlePlayerAttack(): void {
    const gs = GameState.get(this);
    if (!gs.inventory.getEquipped('weapon')) return;
    const zone = this.combatSystem.attack(this.playerFacing);
    if (!zone) return;
    this.showAttackEffect(this.playerFacing);
  }

  private showAttackEffect(facing: string): void {
    const offsets: Record<string, { x: number; y: number; angle: number }> = {
      up: { x: 0, y: -24, angle: 0 },
      down: { x: 0, y: 24, angle: 180 },
      left: { x: -24, y: 0, angle: 270 },
      right: { x: 24, y: 0, angle: 90 },
    };
    const offset = offsets[facing] ?? offsets.down;

    const slash = this.add.graphics();
    slash.setPosition(this.player.x + offset.x, this.player.y + offset.y);
    slash.setDepth(50);
    slash.lineStyle(3, 0xffffff, 0.8);
    slash.beginPath();
    slash.arc(0, 0, 16, Phaser.Math.DegToRad(offset.angle - 45), Phaser.Math.DegToRad(offset.angle + 45));
    slash.strokePath();

    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 200,
      onComplete: () => slash.destroy(),
    });
  }

  private startDialogue(npc: NPC): void {
    const gs = GameState.get(this);
    this.inDialogue = true;
    npc.isInDialogue = true;
    gs.worldState.pause();
    this.interactionPrompt.setVisible(false);

    EventBus.emit(Events.DIALOGUE_START, {
      npc,
      llmClient: gs.llmClient,
      worldState: gs.worldState,
    });

    this.scene.launch('DialogueScene', {
      npc,
      llmClient: gs.llmClient,
      worldState: gs.worldState,
      storylineManager: gs.storylineManager,
      onClose: () => {
        this.inDialogue = false;
        npc.isInDialogue = false;
        gs.worldState.resume();
        EventBus.emit(Events.DIALOGUE_END, { npcId: npc.persona.id });
      },
    });
  }

  private getNPCTrustMap(): Record<string, number> {
    const trustMap: Record<string, number> = {};
    for (const npc of this.npcs) {
      const rel = npc.memory.getRelationship('player');
      trustMap[npc.persona.id] = rel.trust;
    }
    return trustMap;
  }

  private isNearBench(): boolean {
    const forgeX = 368;
    const forgeY = 288;
    const dx = this.player.x - forgeX;
    const dy = this.player.y - forgeY;
    return Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE * 2;
  }

  private openCrafting(): void {
    const gs = GameState.get(this);
    this.inCrafting = true;
    this.scene.launch('CraftingScene', {
      inventory: gs.inventory,
      npcTrustMap: this.getNPCTrustMap(),
      atBench: this.isNearBench(),
    });
    this.scene.get('CraftingScene').events.once('shutdown', () => {
      this.inCrafting = false;
    });
  }

  private openTrade(npc: NPC): void {
    const shop = NPC_SHOPS[npc.persona.id];
    if (!shop) {
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `${npc.persona.name} doesn't have anything to trade.`,
      });
      return;
    }
    const gs = GameState.get(this);
    const rel = npc.memory.getRelationship('player');
    this.inTrading = true;
    this.scene.launch('TradeScene', {
      inventory: gs.inventory,
      shop,
      trust: rel.trust,
    });
    this.scene.get('TradeScene').events.once('shutdown', () => {
      this.inTrading = false;
    });
  }

  private handlePlayerDeath(): void {
    this.combatSystem.resetHealth();
    this.player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.playerLabel.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - TILE_SIZE * 0.7);
    this.playerHealthBar.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 - TILE_SIZE);
    this.playerHealthBar.setHealth(this.combatSystem.getHealth());

    this.player.setTint(0xffffff);
    this.time.delayedCall(INVINCIBILITY_MS * 4, () => {
      this.player.clearTint();
    });

    EventBus.emit(Events.SHOW_NOTIFICATION, 'You have fallen... Respawning at village.');
  }

  // --- Opening Story Overlay ---

  private showOpeningStory(): void {
    if (localStorage.getItem('story_intro_shown')) return;

    const storyBeats = [
      'You awaken near the village of Thornwick with no memory of how you arrived. A strange darkness lingers at the edge of the forest...',
      'The village elder, Sage Aldric, has vanished. His scattered journal pages may hold the key to understanding the creeping Blight that threatens Thornwick.',
      'The villagers may know more. Build their trust through conversation. Explore the village, gather supplies, and uncover the truth.',
      'Your Quest: Find Aldric\'s journal pages, discover three ancient Runestones hidden in dungeons, and activate the Shrine of Dawn to seal the Blight.\n\n[Press any key to begin]',
    ];

    let currentScreen = 0;

    const overlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.85
    );
    overlay.setDepth(300);

    const titleText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'Emergent NPC World', {
      fontSize: fs(42),
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: window.devicePixelRatio,
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(301);

    const bodyText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, storyBeats[0], {
      fontSize: fs(56),
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: GAME_WIDTH * 0.7 },
      lineSpacing: 8,
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    bodyText.setOrigin(0.5);
    bodyText.setDepth(301);

    const instructionText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.8, '[Press any key to continue]', {
      fontSize: fs(22),
      color: '#888888',
      align: 'center',
      resolution: window.devicePixelRatio,
    });
    instructionText.setOrigin(0.5);
    instructionText.setDepth(301);

    const allElements = [overlay, titleText, bodyText, instructionText];
    for (const el of allElements) {
      el.setAlpha(0);
    }
    this.tweens.add({
      targets: allElements,
      alpha: { from: 0, to: 1 },
      duration: 600,
      ease: 'Power2',
    });
    this.tweens.add({
      targets: overlay,
      alpha: 0.85,
      duration: 600,
      ease: 'Power2',
    });

    const advance = () => {
      currentScreen++;
      if (currentScreen >= storyBeats.length) {
        localStorage.setItem('story_intro_shown', 'true');
        this.tweens.add({
          targets: allElements,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            for (const el of allElements) el.destroy();
          },
        });
        this.input.keyboard!.off('keydown', advance);
        this.input.off('pointerdown', advance);
        return;
      }

      bodyText.setAlpha(0);
      bodyText.setText(storyBeats[currentScreen]);

      if (currentScreen === storyBeats.length - 1) {
        titleText.setText('The Blight Awaits');
        titleText.setAlpha(0);
        instructionText.setVisible(false);
        this.tweens.add({ targets: titleText, alpha: 1, duration: 400 });
      }

      this.tweens.add({
        targets: bodyText,
        alpha: 1,
        duration: 400,
        ease: 'Power2',
      });
    };

    this.input.keyboard!.on('keydown', advance);
    this.input.on('pointerdown', advance);
  }

  // --- Inn Marker ---

  private createInnMarker(): void {
    const innX = 704;
    const innY = 248;

    this.innMarker = this.add.text(innX, innY, '!', {
      fontSize: fs(56),
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      resolution: window.devicePixelRatio,
    });
    this.innMarker.setOrigin(0.5);
    this.innMarker.setDepth(15);

    this.tweens.add({
      targets: this.innMarker,
      alpha: { from: 0.4, to: 1.0 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.innMarkerListener = (data: { npc: { persona: { id: string; name: string } } }) => {
      if (data.npc.persona.id === 'innkeeper_rose' || data.npc.persona.name === 'Rose') {
        this.destroyInnMarker();
      }
    };
    EventBus.on(Events.DIALOGUE_START, this.innMarkerListener);
  }

  private destroyInnMarker(): void {
    if (this.innMarkerListener) {
      EventBus.off(Events.DIALOGUE_START, this.innMarkerListener);
      this.innMarkerListener = null;
    }
    if (this.innMarker) {
      this.tweens.killTweensOf(this.innMarker);
      this.innMarker.destroy();
      this.innMarker = null;
    }
  }
}
