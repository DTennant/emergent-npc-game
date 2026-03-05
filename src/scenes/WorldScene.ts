import Phaser from 'phaser';
import { NPC } from '../npc/NPC';
import { NPC_PERSONAS } from '../npc/personas';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { EventBus, Events } from '../world/EventBus';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  PLAYER_SPEED,
  INTERACTION_DISTANCE,
  COLORS,
} from '../config';

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
  };
  private npcs: NPC[] = [];
  private llmClient!: LLMClient;
  private worldState!: WorldState;
  private inDialogue = false;
  private interactionPrompt!: Phaser.GameObjects.Text;
  private nearestNPC: NPC | null = null;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    this.llmClient = new LLMClient();
    this.worldState = new WorldState();

    // Create world
    this.createWorld();

    // Create player
    this.player = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      TILE_SIZE * 0.8,
      TILE_SIZE * 0.8,
      COLORS.player
    );
    this.player.setStrokeStyle(2, 0xffffff);
    this.player.setDepth(10);

    // Player label
    const playerLabel = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE * 0.7,
      'You',
      {
        fontSize: '11px',
        color: '#88bbff',
        stroke: '#000000',
        strokeThickness: 2,
      }
    );
    playerLabel.setOrigin(0.5, 1);
    playerLabel.setDepth(11);

    // Store reference for update
    (this.player as any).label = playerLabel;

    // Create NPCs
    for (const persona of NPC_PERSONAS) {
      const npc = new NPC(this, persona);
      this.npcs.push(npc);
    }

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    // Interaction prompt
    this.interactionPrompt = this.add.text(0, 0, '[E] Talk', {
      fontSize: '12px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 3,
      backgroundColor: '#00000088',
      padding: { x: 4, y: 2 },
    });
    this.interactionPrompt.setOrigin(0.5);
    this.interactionPrompt.setDepth(20);
    this.interactionPrompt.setVisible(false);

    // Launch HUD scene
    this.scene.launch('HUDScene', { worldState: this.worldState, llmClient: this.llmClient });

    // E key handler
    this.wasd.E.on('down', () => {
      if (this.inDialogue) return;
      if (this.nearestNPC) {
        this.startDialogue(this.nearestNPC);
      }
    });
  }

  update(_time: number, delta: number): void {
    if (this.inDialogue) return;

    // Update world state
    this.worldState.update(delta);

    // Player movement
    this.handlePlayerMovement(delta);

    // Update NPCs
    for (const npc of this.npcs) {
      npc.update(delta, this.worldState);
    }

    // Check NPC proximity
    this.checkNPCProximity();
  }

  private createWorld(): void {
    // Fill with grass
    for (let x = 0; x < GAME_WIDTH; x += TILE_SIZE) {
      for (let y = 0; y < GAME_HEIGHT; y += TILE_SIZE) {
        const shade = 0.9 + Math.random() * 0.2;
        const r = Math.floor(((COLORS.grass >> 16) & 0xff) * shade);
        const g = Math.floor(((COLORS.grass >> 8) & 0xff) * shade);
        const b = Math.floor((COLORS.grass & 0xff) * shade);
        const color = (r << 16) | (g << 8) | b;
        this.add.rectangle(
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          color
        ).setDepth(0);
      }
    }

    // Buildings (simple colored rectangles with labels)
    const buildings = [
      { x: 230, y: 180, w: 80, h: 60, color: COLORS.forge, label: '⚒️ Forge' },
      { x: 440, y: 180, w: 90, h: 70, color: COLORS.inn, label: '🍺 Inn' },
      { x: 370, y: 290, w: 70, h: 50, color: COLORS.market, label: '🛒 Shop' },
      { x: 640, y: 430, w: 100, h: 60, color: COLORS.farm, label: '🌾 Farm' },
      { x: 100, y: 350, w: 60, h: 50, color: COLORS.guardPost, label: '🛡️ Guard' },
      { x: 500, y: 100, w: 70, h: 50, color: COLORS.herbShop, label: '🌿 Herbs' },
    ];

    for (const b of buildings) {
      // Building
      const bldg = this.add.rectangle(b.x, b.y, b.w, b.h, b.color, 0.7);
      bldg.setStrokeStyle(2, 0x000000, 0.5);
      bldg.setDepth(1);

      // Label
      this.add
        .text(b.x, b.y - b.h / 2 - 8, b.label, {
          fontSize: '10px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(2);
    }

    // Paths (simple rectangles)
    const paths = [
      { x: 340, y: 200, w: 120, h: 12 },  // Forge to Inn
      { x: 400, y: 240, w: 12, h: 80 },    // Inn to Shop
      { x: 500, y: 300, w: 200, h: 12 },   // Shop to Farm
      { x: 200, y: 280, w: 12, h: 100 },   // Forge to Guard
      { x: 500, y: 150, w: 12, h: 60 },    // Inn to Herbs
    ];

    for (const p of paths) {
      this.add.rectangle(p.x, p.y, p.w, p.h, COLORS.path, 0.6).setDepth(0);
    }

    // Village name
    this.add
      .text(GAME_WIDTH / 2, 20, '🏘️ Thornwick Village', {
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(15);
  }

  private handlePlayerMovement(delta: number): void {
    const speed = PLAYER_SPEED * (delta / 1000);
    let dx = 0;
    let dy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) dx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) dx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) dy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) dy += 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.player.x = Math.max(20, Math.min(GAME_WIDTH - 20, this.player.x + dx * speed));
    this.player.y = Math.max(20, Math.min(GAME_HEIGHT - 20, this.player.y + dy * speed));

    // Update label position
    const label = (this.player as any).label as Phaser.GameObjects.Text;
    if (label) {
      label.setPosition(this.player.x, this.player.y - TILE_SIZE * 0.7);
    }
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
      this.interactionPrompt.setPosition(
        closest.sprite.x,
        closest.sprite.y - TILE_SIZE * 1.2
      );
      this.interactionPrompt.setText(`[E] Talk to ${closest.persona.name}`);
      this.interactionPrompt.setVisible(true);
    } else {
      this.interactionPrompt.setVisible(false);
    }
  }

  private startDialogue(npc: NPC): void {
    this.inDialogue = true;
    npc.isInDialogue = true;
    this.worldState.pause();
    this.interactionPrompt.setVisible(false);

    EventBus.emit(Events.DIALOGUE_START, {
      npc,
      llmClient: this.llmClient,
      worldState: this.worldState,
    });

    // Launch dialogue scene
    this.scene.launch('DialogueScene', {
      npc,
      llmClient: this.llmClient,
      worldState: this.worldState,
      onClose: () => {
        this.inDialogue = false;
        npc.isInDialogue = false;
        this.worldState.resume();
        EventBus.emit(Events.DIALOGUE_END, { npcId: npc.persona.id });
      },
    });
  }
}
