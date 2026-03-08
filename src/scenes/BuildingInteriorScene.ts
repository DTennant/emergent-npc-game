import Phaser from 'phaser';
import { BuildingInterior, BUILDING_INTERIORS } from '../buildings/BuildingData';
import { NPC } from '../npc/NPC';
import { NPC_PERSONAS } from '../npc/personas';
import { EventBus, Events } from '../world/EventBus';
import { GameState, NPCSaveState } from '../world/GameState';
import { NPC_SHOPS } from '../crafting/TradeData';
import { TextureKeys } from '../assets/keys';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  PLAYER_SPEED,
  INTERACTION_DISTANCE,
  fs,
} from '../config';

interface BuildingInitData {
  buildingId: string;
  returnScene: string;
  returnX: number;
  returnY: number;
}

export class BuildingInteriorScene extends Phaser.Scene {
  private building!: BuildingInterior;
  private returnScene!: string;
  private returnX!: number;
  private returnY!: number;
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
  private escKey!: Phaser.Input.Keyboard.Key;
  private npc: NPC | null = null;
  private interactionPrompt!: Phaser.GameObjects.Text;
  private roomLabel!: Phaser.GameObjects.Text;
  private notificationText!: Phaser.GameObjects.Text;
  private notificationTimer = 0;
  private inDialogue = false;
  private inInventory = false;
  private inTrading = false;
  private inCrafting = false;
  private cleanedUp = false;
  private invalidBuilding = false;
  private furnitureGroup!: Phaser.Physics.Arcade.StaticGroup;
  private wallGroup!: Phaser.Physics.Arcade.StaticGroup;
  private playerFacing = 'down';

  constructor() {
    super({ key: 'BuildingInteriorScene' });
  }

  init(data: BuildingInitData): void {
    this.invalidBuilding = false;
    this.inDialogue = false;
    this.inInventory = false;
    this.inCrafting = false;
    this.inTrading = false;
    this.cleanedUp = false;
    const def = BUILDING_INTERIORS.find((b) => b.id === data.buildingId);
    if (!def) {
      this.invalidBuilding = true;
      this.scene.start(data.returnScene ?? 'WorldScene');
      return;
    }
    this.building = def;
    this.returnScene = data.returnScene;
    this.returnX = data.returnX;
    this.returnY = data.returnY;
  }

  create(): void {
    if (this.invalidBuilding) return;
    const gs = GameState.get(this);
    this.cleanedUp = false;

    this.cameras.main.setBackgroundColor(this.building.bgColor);
    this.cameras.main.resetFX();
    this.cameras.main.fadeIn(400);

    this.createRoom();

    this.player = this.physics.add.sprite(
      this.building.spawnPoint.x,
      this.building.spawnPoint.y,
      TextureKeys.PLAYER
    );
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

    this.npc = null;
    const persona = NPC_PERSONAS.find((p) => p.id === this.building.npcId);
    if (persona) {
      this.npc = new NPC(this, persona);
      this.npc.sprite.setPosition(this.building.npcPosition.x, this.building.npcPosition.y);
      this.npc.nameTag.setPosition(
        this.building.npcPosition.x,
        this.building.npcPosition.y - TILE_SIZE * 0.7
      );

      const saved = gs.npcData.get(persona.id);
      if (saved) {
        this.npc.memory.fromJSON(saved.memory);
        this.npc.goals.fromJSON(saved.goals);
      }
    }

    this.physics.add.collider(this.player, this.furnitureGroup);
    this.physics.add.collider(this.player, this.wallGroup);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      I: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I),
    };
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.roomLabel = this.add.text(10, 10, this.building.name, {
      fontSize: fs(30),
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.roomLabel.setDepth(100);
    this.roomLabel.setScrollFactor(0);

    const escLabel = this.add.text(GAME_WIDTH - 10, 10, '[ESC] Exit', {
      fontSize: fs(26),
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    escLabel.setOrigin(1, 0);
    escLabel.setDepth(100);
    escLabel.setScrollFactor(0);

    this.interactionPrompt = this.add.text(0, 0, '', {
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

    this.notificationText = this.add.text(GAME_WIDTH / 2, 60, '', {
      fontSize: fs(28),
      color: '#44ff88',
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000088',
      padding: { x: 16, y: 8 },
      resolution: window.devicePixelRatio,
    });
    this.notificationText.setOrigin(0.5);
    this.notificationText.setDepth(100);
    this.notificationText.setScrollFactor(0);
    this.notificationText.setVisible(false);

    EventBus.on(Events.SHOW_NOTIFICATION, this.onShowNotification, this);
    EventBus.on(Events.DIALOGUE_END, this.onDialogueEnd, this);

    this.wasd.E.on('down', () => {
      if (this.inDialogue) return;
      if (this.isNearNPC()) {
        this.startDialogue();
        return;
      }
      if (this.isNearDoor()) {
        this.exitBuilding();
      }
    });

    this.wasd.I.on('down', () => {
      if (this.inDialogue) return;
      if (this.inInventory) {
        this.scene.stop('InventoryScene');
        this.inInventory = false;
      } else {
        this.inInventory = true;
        this.scene.launch('InventoryScene', { inventory: gs.inventory });
        this.scene.get('InventoryScene').events.once('shutdown', () => {
          this.inInventory = false;
        });
      }
    });

    this.input.keyboard!.addKey('J').on('down', () => {
      if (this.inDialogue) return;
      if (this.scene.isActive('QuestJournalScene')) {
        this.scene.stop('QuestJournalScene');
      } else {
        this.scene.launch('QuestJournalScene');
      }
    });

    this.input.keyboard!.addKey('T').on('down', () => {
      if (this.inTrading) {
        this.scene.stop('TradeScene');
        this.inTrading = false;
        return;
      }
      if (this.inDialogue || this.inInventory || this.inCrafting) return;
      if (this.isNearNPC()) {
        this.openTrade();
      }
    });

    this.input.keyboard!.addKey('C').on('down', () => {
      if (this.inCrafting) {
        this.scene.stop('CraftingScene');
        this.inCrafting = false;
        return;
      }
      if (this.inDialogue || this.inInventory || this.inTrading) return;
      this.inCrafting = true;
      this.scene.launch('CraftingScene', {
        inventory: gs.inventory,
        npcTrustMap: this.getNPCTrustMap(),
        atBench: this.building.id === 'forge',
      });
      this.scene.get('CraftingScene').events.once('shutdown', () => {
        this.inCrafting = false;
      });
    });

    this.escKey.on('down', () => {
      this.exitBuilding();
    });

    EventBus.emit(Events.BUILDING_ENTER, { buildingId: this.building.id });

    this.scene.launch('HUDScene', { worldState: gs.worldState, llmClient: gs.llmClient });
  }

  update(_time: number, delta: number): void {
    const gs = GameState.get(this);
    gs.worldState.update(delta);

    if (this.npc && !this.inDialogue) {
      this.npc.update(delta, gs.worldState);
    }

    if (this.inDialogue || this.inTrading || this.inCrafting || this.inInventory) return;

    this.handlePlayerMovement();
    this.checkProximity();

    this.playerLabel.setPosition(this.player.x, this.player.y - TILE_SIZE * 0.7);

    if (this.notificationTimer > 0) {
      this.notificationTimer -= delta;
      if (this.notificationTimer <= 0) {
        this.notificationText.setVisible(false);
      }
    }
  }

  private createRoom(): void {
    const T = TILE_SIZE;
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;

    for (let x = 0; x < W; x += T) {
      for (let y = 0; y < H; y += T) {
        this.add.rectangle(x + T / 2, y + T / 2, T, T, this.building.floorColor).setDepth(0);
      }
    }

    this.wallGroup = this.physics.add.staticGroup();
    const wallThickness = T;
    const doorX = this.building.doorPosition.x;
    const doorY = this.building.doorPosition.y;
    const doorGap = T * 2;
    const bottomY = H - wallThickness / 2;
    const leftWallW = doorX - doorGap / 2;
    const rightWallW = W - (doorX + doorGap / 2);

    const walls = [
      { x: W / 2, y: wallThickness / 2, w: W, h: wallThickness },
      { x: leftWallW / 2, y: bottomY, w: leftWallW, h: wallThickness },
      { x: doorX + doorGap / 2 + rightWallW / 2, y: bottomY, w: rightWallW, h: wallThickness },
      { x: wallThickness / 2, y: H / 2, w: wallThickness, h: H },
      { x: W - wallThickness / 2, y: H / 2, w: wallThickness, h: H },
    ];

    for (const wall of walls) {
      if (wall.w <= 0) continue;
      this.add.rectangle(wall.x, wall.y, wall.w, wall.h, this.building.wallColor).setDepth(1);
      const wallBody = this.wallGroup.create(wall.x, wall.y, undefined) as Phaser.Physics.Arcade.Sprite;
      wallBody.setVisible(false);
      const body = wallBody.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(wall.w, wall.h);
      body.setOffset(-wall.w / 2, -wall.h / 2);
    }

    this.add.rectangle(doorX, bottomY, doorGap, wallThickness, 0x00aa00, 0.4).setDepth(2);
    const doorLabel = this.add.text(doorX, doorY - T, '[ESC / E] Exit', {
      fontSize: fs(22),
      color: '#88ff88',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    doorLabel.setOrigin(0.5);
    doorLabel.setDepth(15);

    this.furnitureGroup = this.physics.add.staticGroup();

    for (const furn of this.building.furniture) {
      const rect = this.add.rectangle(furn.x, furn.y, furn.w, furn.h, furn.color);
      rect.setDepth(1);

      const furnBody = this.furnitureGroup.create(furn.x, furn.y, undefined) as Phaser.Physics.Arcade.Sprite;
      furnBody.setVisible(false);
      const body = furnBody.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(furn.w, furn.h);
      body.setOffset(-furn.w / 2, -furn.h / 2);

      if (furn.label) {
        this.add.text(furn.x, furn.y - furn.h / 2 - 8, furn.label, {
          fontSize: fs(18),
          color: '#bbbbbb',
          stroke: '#000000',
          strokeThickness: 1,
          resolution: window.devicePixelRatio,
        }).setOrigin(0.5).setDepth(2);
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

  private checkProximity(): void {
    if (this.npc && this.isNearNPC()) {
      this.interactionPrompt.setPosition(
        this.npc.sprite.x,
        this.npc.sprite.y - TILE_SIZE * 1.2
      );
      const hasShop = NPC_SHOPS[this.npc.persona.id] !== undefined;
      const tradeHint = hasShop ? '  [T] Trade' : '';
      this.interactionPrompt.setText(`[E] Talk to ${this.npc.persona.name}${tradeHint}`);
      this.interactionPrompt.setVisible(true);
    } else if (this.isNearDoor()) {
      this.interactionPrompt.setPosition(
        this.building.doorPosition.x,
        this.building.doorPosition.y - TILE_SIZE
      );
      this.interactionPrompt.setText('[E] Exit');
      this.interactionPrompt.setVisible(true);
    } else {
      this.interactionPrompt.setVisible(false);
    }
  }

  private isNearNPC(): boolean {
    if (!this.npc) return false;
    const dx = this.player.x - this.npc.sprite.x;
    const dy = this.player.y - this.npc.sprite.y;
    return Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE;
  }

  private isNearDoor(): boolean {
    const dx = this.player.x - this.building.doorPosition.x;
    const dy = this.player.y - this.building.doorPosition.y;
    return Math.sqrt(dx * dx + dy * dy) < INTERACTION_DISTANCE;
  }

  private startDialogue(): void {
    if (!this.npc) return;
    if (this.npc.isSleeping()) {
      EventBus.emit(Events.SHOW_NOTIFICATION, { message: `${this.npc.persona.name} is sleeping...` });
      return;
    }
    const gs = GameState.get(this);
    const npc = this.npc;
    this.inDialogue = true;
    npc.isInDialogue = true;
    this.interactionPrompt.setVisible(false);
    gs.worldState.pause();

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
        this.saveNPCState();
        EventBus.emit(Events.DIALOGUE_END, { npcId: npc.persona.id });
      },
    });
  }

  private openTrade(): void {
    if (!this.npc) return;
    const shop = NPC_SHOPS[this.npc.persona.id];
    if (!shop) {
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `${this.npc.persona.name} doesn't have anything to trade.`,
      });
      return;
    }
    const gs = GameState.get(this);
    const rel = this.npc.memory.getRelationship('player');
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

  private getNPCTrustMap(): Record<string, number> {
    const trustMap: Record<string, number> = {};
    if (this.npc) {
      const rel = this.npc.memory.getRelationship('player');
      trustMap[this.npc.persona.id] = rel.trust;
    }
    return trustMap;
  }

  private saveNPCState(): void {
    if (!this.npc) return;
    const gs = GameState.get(this);
    gs.npcData.set(this.npc.persona.id, {
      memory: this.npc.memory.toJSON() as NPCSaveState['memory'],
      goals: this.npc.goals.toJSON(),
      position: { x: this.npc.sprite.x, y: this.npc.sprite.y },
    });
  }

  private exitBuilding(): void {
    this.saveNPCState();
    this.scene.stop('HUDScene');
    this.cleanup();
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      EventBus.emit(Events.BUILDING_EXIT, { buildingId: this.building.id });
      this.scene.start(this.returnScene, {
        spawnX: this.returnX,
        spawnY: this.returnY,
      });
    });
  }

  private onDialogueEnd(): void {
    this.saveNPCState();
  }

  private onShowNotification(data: string | { message?: string; text?: string }): void {
    const msg = typeof data === 'string' ? data : (data.message ?? data.text ?? '');
    this.notificationText.setText(msg);
    this.notificationText.setVisible(true);
    this.notificationTimer = 3000;
  }

  private cleanup(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;
    EventBus.off(Events.SHOW_NOTIFICATION, this.onShowNotification, this);
    EventBus.off(Events.DIALOGUE_END, this.onDialogueEnd, this);
    if (this.npc) {
      this.npc.destroy();
      this.npc = null;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  shutdown(): void {
    this.cleanup();
  }
}
