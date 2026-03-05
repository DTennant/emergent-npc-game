import Phaser from 'phaser';
import { NPC } from '../npc/NPC';
import { NPC_PERSONAS } from '../npc/personas';
import { GossipSystem } from '../npc/GossipSystem';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { Inventory } from '../inventory/Inventory';
import { SaveManager } from '../persistence/SaveManager';
import { BlightSystem } from '../world/BlightSystem';
import { EventBus, Events } from '../world/EventBus';
import { GossipPacket } from '../memory/types';
import { TextureKeys } from '../assets/keys';
import { AldricJournal, JOURNAL_PAGES } from '../story/AldricJournal';
import { StorylineManager } from '../story/StorylineManager';
import { CombatSystem } from '../combat/CombatSystem';
import { HealthBar } from '../combat/HealthBar';
import { Enemy, WOLF_CONFIG } from '../combat/Enemy';
import { DUNGEONS } from '../dungeons/DungeonData';
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
} from '../config';

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
  private llmClient!: LLMClient;
  private worldState!: WorldState;
  private inventory!: Inventory;
  private inDialogue = false;
  private inInventory = false;
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
  private aldricJournal!: AldricJournal;
  private storylineManager!: StorylineManager;
  private journalSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private enemies: Enemy[] = [];
  private dungeonEntranceZones: Phaser.GameObjects.Zone[] = [];
  private shrineZone!: Phaser.GameObjects.Rectangle;
  private shrineLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'WorldScene' });
  }

  create(): void {
    this.llmClient = new LLMClient();
    this.worldState = new WorldState();
    this.inventory = new Inventory();
    this.aldricJournal = new AldricJournal();
    this.storylineManager = new StorylineManager();

    this.createWorld();
    this.createJournalPages();

    this.blightSystem = new BlightSystem(this);

    this.createShrineOfDawn();

    this.player = this.physics.add.sprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      TextureKeys.PLAYER
    );
    this.player.setDepth(10);
    this.player.setCollideWorldBounds(true);

    this.playerLabel = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE * 0.7,
      'You',
      {
        fontSize: '11px',
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

    this.gossipSystem = new GossipSystem(this.npcs);

    this.createDungeonEntrances();

    this.physics.add.collider(this.player, this.buildingGroup);
    this.physics.add.collider(this.npcGroup, this.buildingGroup);

    this.restoreFromSave();

    EventBus.on(Events.DAY_CHANGE, (data: { day: number }) => {
      this.blightSystem.update(data.day);
      this.updateBlightWorldState();
      this.saveGame();
    });
    EventBus.on(Events.DIALOGUE_END, () => {
      this.saveGame();
    });
    EventBus.on(Events.NPC_GOSSIP, (packet: GossipPacket) => {
      this.trackGossipForPromotion(packet);
    });
    EventBus.on(Events.LLM_CONFIG_CHANGED, () => {
      this.llmClient.reloadConfig();
    });

    EventBus.on(Events.ITEM_ACQUIRED, (data: { itemId: string }) => {
      if (data.itemId.startsWith('aldric_journal_') && !this.storylineManager.blightAwareness) {
        this.storylineManager.discoverBlight();
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
        this.storylineManager.obtainRunestone(dungeonId);
        EventBus.emit(Events.SHOW_NOTIFICATION, {
          message: `Runestone obtained! (${this.storylineManager.getRunestoneCount()}/3)`,
        });
      }
    });

    this.combatSystem = new CombatSystem(this, this.player);
    this.playerHealthBar = new HealthBar(
      this,
      this.player.x,
      this.player.y - TILE_SIZE,
      TILE_SIZE,
      4,
      PLAYER_MAX_HEALTH
    );

    EventBus.on(Events.PLAYER_DIED, () => {
      this.handlePlayerDeath();
    });

    this.spawnEnemies();

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
      fontSize: '12px',
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

    this.scene.launch('HUDScene', { worldState: this.worldState, llmClient: this.llmClient });

    this.wasd.E.on('down', () => {
      if (this.inDialogue) return;
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
      if (this.inDialogue) return;
      if (this.inInventory) {
        this.scene.stop('InventoryScene');
        this.inInventory = false;
      } else {
        this.inInventory = true;
        this.scene.launch('InventoryScene', { inventory: this.inventory });
        this.scene.get('InventoryScene').events.once('shutdown', () => {
          this.inInventory = false;
        });
      }
    });

    this.spaceKey.on('down', () => {
      if (this.inDialogue) return;
      this.handlePlayerAttack();
    });
  }

  update(_time: number, delta: number): void {
    if (this.inDialogue) return;

    this.worldState.update(delta);

    this.handlePlayerMovement();

    for (const npc of this.npcs) {
      npc.update(delta, this.worldState);
    }

    this.gossipSystem.update(delta, this.worldState.getDay());

    for (const enemy of this.enemies) {
      if (!enemy.isDead()) {
        enemy.update(delta, this.player.x, this.player.y);
      }
    }

    this.checkEnemyAttacks();

    this.checkNPCProximity();

    this.playerLabel.setPosition(this.player.x, this.player.y - TILE_SIZE * 0.7);

    this.playerHealthBar.setPosition(this.player.x, this.player.y - TILE_SIZE);
    this.playerHealthBar.setHealth(this.combatSystem.getHealth());
  }

  private createWorld(): void {
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

    this.buildingGroup = this.physics.add.staticGroup();

    const buildings = [
      { x: 230, y: 180, w: 80, h: 60, texture: TextureKeys.BUILDING_FORGE, label: '\u2692\uFE0F Forge' },
      { x: 440, y: 180, w: 90, h: 70, texture: TextureKeys.BUILDING_INN, label: '\uD83C\uDF7A Inn' },
      { x: 370, y: 290, w: 70, h: 50, texture: TextureKeys.BUILDING_MARKET, label: '\uD83D\uDED2 Shop' },
      { x: 640, y: 430, w: 100, h: 60, texture: TextureKeys.BUILDING_FARM, label: '\uD83C\uDF3E Farm' },
      { x: 100, y: 350, w: 60, h: 50, texture: TextureKeys.BUILDING_GUARD, label: '\uD83D\uDEE1\uFE0F Guard' },
      { x: 500, y: 100, w: 70, h: 50, texture: TextureKeys.BUILDING_HERBS, label: '\uD83C\uDF3F Herbs' },
    ];

    for (const b of buildings) {
      const bldg = this.buildingGroup.create(b.x, b.y, b.texture) as Phaser.Physics.Arcade.Sprite;
      bldg.setDepth(1);

      const body = bldg.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(
        b.w * BUILDING_COLLISION_PADDING,
        b.h * BUILDING_COLLISION_PADDING
      );

      this.add
        .text(b.x, b.y - b.h / 2 - 8, b.label, {
          fontSize: '10px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 2,
          resolution: window.devicePixelRatio,
        })
        .setOrigin(0.5)
        .setDepth(2);
    }

    const paths = [
      { x: 340, y: 200, w: 120, h: 12 },
      { x: 400, y: 240, w: 12, h: 80 },
      { x: 500, y: 300, w: 200, h: 12 },
      { x: 200, y: 280, w: 12, h: 100 },
      { x: 500, y: 150, w: 12, h: 60 },
    ];

    for (const p of paths) {
      this.add.rectangle(p.x, p.y, p.w, p.h, COLORS.path, 0.6).setDepth(0);
    }

    this.add
      .text(GAME_WIDTH / 2, 20, '\uD83C\uDFD8\uFE0F Thornwick Village', {
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: window.devicePixelRatio,
      })
      .setOrigin(0.5)
      .setDepth(15);
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
      this.interactionPrompt.setPosition(
        closest.sprite.x,
        closest.sprite.y - TILE_SIZE * 1.2
      );
      this.interactionPrompt.setText(`[E] Talk to ${closest.persona.name}`);
      this.interactionPrompt.setVisible(true);
    } else if (this.isNearShrine()) {
      this.interactionPrompt.setPosition(400, 38);
      this.interactionPrompt.setText('[E] Activate Shrine');
      this.interactionPrompt.setVisible(true);
    } else {
      const nearPage = this.getNearbyJournalPage();
      if (nearPage) {
        this.interactionPrompt.setPosition(
          nearPage.position.x,
          nearPage.position.y - 20
        );
        this.interactionPrompt.setText('[E] Pick up journal page');
        this.interactionPrompt.setVisible(true);
      } else {
        this.interactionPrompt.setVisible(false);
      }
    }
  }

  private saveGame(): void {
    this.worldState.blightSystemData = this.blightSystem.toJSON();
    this.worldState.storylineData = this.storylineManager.toJSON();
    SaveManager.save(
      this.worldState,
      this.npcs,
      this.inventory,
      { x: this.player.x, y: this.player.y }
    );
  }

  private restoreFromSave(): void {
    const saveData = SaveManager.load();
    if (!saveData) return;

    this.worldState.fromJSON(saveData.world);

    for (const npc of this.npcs) {
      const npcSave = saveData.npcs[npc.persona.id];
      if (npcSave) {
        npc.memory.fromJSON(npcSave.memory);
        npc.sprite.setPosition(npcSave.position.x, npcSave.position.y);
        npc.nameTag.setPosition(
          npcSave.position.x,
          npcSave.position.y - TILE_SIZE * 0.7
        );
      }
    }

    this.inventory.fromJSON(saveData.inventory);

    if (saveData.world.blightSystem) {
      this.blightSystem.fromJSON(saveData.world.blightSystem);
    }

    if (saveData.world.storyline) {
      this.storylineManager.fromJSON(saveData.world.storyline);
    }

    this.player.setPosition(saveData.player.x, saveData.player.y);
    this.playerLabel.setPosition(saveData.player.x, saveData.player.y - TILE_SIZE * 0.7);
  }

  private trackGossipForPromotion(packet: GossipPacket): void {
    const key = `${packet.subject}::${packet.content}`;
    const knowers = this.gossipTracker.get(key) ?? new Set<string>();
    knowers.add(packet.from);
    knowers.add(packet.to);
    this.gossipTracker.set(key, knowers);

    if (knowers.size >= 3) {
      this.worldState.villageMemory.promoteFromGossip(
        packet.subject,
        packet.content,
        Array.from(knowers),
        this.worldState.getDay()
      );
    }
  }

  private createJournalPages(): void {
    for (const page of JOURNAL_PAGES) {
      if (this.aldricJournal.isDiscovered(page.id)) continue;

      const rect = this.add.rectangle(
        page.position.x,
        page.position.y,
        12,
        16,
        0xffd700
      );
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
    this.shrineZone = this.add.rectangle(400, 60, 60, 40, 0xffd700, 0.3);
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

    this.shrineLabel = this.add.text(400, 38, 'Shrine of Dawn', {
      fontSize: '10px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: window.devicePixelRatio,
    });
    this.shrineLabel.setOrigin(0.5);
    this.shrineLabel.setDepth(4);
  }

  private createDungeonEntrances(): void {
    const entranceDefs = [
      { dungeonId: 'forest_cave', x: 780, y: 300, w: 40, h: 80, color: 0x1a3a0a, label: 'Forest Cave' },
      { dungeonId: 'abandoned_mine', x: 700, y: 580, w: 80, h: 40, color: 0x3a3a3a, label: 'Abandoned Mine' },
      { dungeonId: 'ruined_tower', x: 780, y: 80, w: 40, h: 80, color: 0x3a0a3a, label: 'Ruined Tower' },
    ];

    for (const ent of entranceDefs) {
      const dungeon = DUNGEONS.find((d) => d.id === ent.dungeonId);
      if (!dungeon) continue;

      const rect = this.add.rectangle(ent.x, ent.y, ent.w, ent.h, ent.color, 0.7);
      rect.setDepth(1);
      rect.setStrokeStyle(2, 0xffffff, 0.3);

      const label = this.add.text(ent.x, ent.y - ent.h / 2 - 10, ent.label, {
        fontSize: '9px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        resolution: window.devicePixelRatio,
      });
      label.setOrigin(0.5);
      label.setDepth(15);

      const zone = this.add.zone(ent.x, ent.y, ent.w, ent.h);
      this.physics.add.existing(zone, true);
      this.dungeonEntranceZones.push(zone);

      this.physics.add.overlap(
        this.player,
        zone,
        () => {
          this.tryEnterDungeon(dungeon.id, dungeon.requiredItem, dungeon.name);
        },
        undefined,
        this
      );
    }
  }

  private tryEnterDungeon(dungeonId: string, requiredItem: string, dungeonName: string): void {
    if (this.inDialogue || this.inInventory) return;

    if (!this.inventory.hasItem(requiredItem)) {
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `You need a ${requiredItem.replace('_', ' ')} to enter ${dungeonName}.`,
      });
      const pushback = 40;
      this.player.setPosition(this.player.x - pushback, this.player.y);
      return;
    }

    this.scene.start('DungeonScene', {
      dungeonId,
      inventory: this.inventory,
    });
  }

  private isNearShrine(): boolean {
    const dx = this.player.x - 400;
    const dy = this.player.y - 60;
    return Math.abs(dx) < 35 && Math.abs(dy) < 25;
  }

  private tryActivateShrine(): void {
    if (!this.isNearShrine()) return;

    if (this.storylineManager.shrineActivated) {
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: 'The Shrine of Dawn glows with peaceful light. The Blight is sealed.',
      });
      return;
    }

    if (this.storylineManager.canActivateShrine()) {
      this.storylineManager.activateShrine();
      this.blightSystem.seal();
      this.updateBlightWorldState();

      this.tweens.killTweensOf(this.shrineZone);
      this.shrineZone.setFillStyle(0xffd700, 0.8);
      this.shrineZone.setAlpha(1);

      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: 'The Shrine of Dawn blazes with golden light! The Blight is sealed forever!',
      });
    } else {
      const count = this.storylineManager.getRunestoneCount();
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `You need all 3 Runestones to activate the Shrine. (${count}/3 found)`,
      });
    }
  }

  private getNearbyJournalPage(): typeof JOURNAL_PAGES[number] | null {
    for (const page of JOURNAL_PAGES) {
      if (this.aldricJournal.isDiscovered(page.id)) continue;
      const dx = this.player.x - page.position.x;
      const dy = this.player.y - page.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACTION_DISTANCE) {
        return page;
      }
    }
    return null;
  }

  private tryPickupJournalPage(): void {
    const page = this.getNearbyJournalPage();
    if (!page) return;

    this.aldricJournal.discoverPage(page.id);
    this.inventory.addItem(page.id);

    const sprite = this.journalSprites.get(page.id);
    if (sprite) {
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
      this.journalSprites.delete(page.id);
    }

    EventBus.emit(Events.SHOW_NOTIFICATION, {
      message: `Found: ${page.title}`,
    });
  }

  private updateBlightWorldState(): void {
    const intensity = this.blightSystem.getIntensity();
    this.worldState.village.blightIntensity = intensity;
    this.worldState.village.safety = Math.max(0, 0.8 - intensity * 0.6);

    const blightFacts: string[] = [];
    if (intensity > 0.2) blightFacts.push('Dark tendrils creep from the Ancient Forest');
    if (intensity > 0.4) blightFacts.push('Corrupted wolves roam closer to the village');
    if (intensity > 0.6) blightFacts.push('The Blight visibly darkens the eastern sky');
    if (intensity > 0.8) blightFacts.push('Thornwick is in grave danger from the spreading darkness');

    this.worldState.worldFacts = this.worldState.worldFacts.filter(
      (f) =>
        f !== 'Dark tendrils creep from the Ancient Forest' &&
        f !== 'Corrupted wolves roam closer to the village' &&
        f !== 'The Blight visibly darkens the eastern sky' &&
        f !== 'Thornwick is in grave danger from the spreading darkness'
    );
    this.worldState.worldFacts.push(...blightFacts);
  }

  private spawnEnemies(): void {
    const count = this.blightSystem.getWolfSpawnCount();

    for (let i = 0; i < count; i++) {
      const x = GAME_WIDTH * 0.7 + Math.random() * GAME_WIDTH * 0.25;
      const y = GAME_HEIGHT * 0.6 + Math.random() * GAME_HEIGHT * 0.35;
      const wolf = new Enemy(
        this,
        x,
        y,
        TextureKeys.ENEMY_WOLF,
        WOLF_CONFIG
      );
      this.physics.add.collider(wolf.sprite, this.buildingGroup);
      this.enemies.push(wolf);
    }

    EventBus.on(Events.ENTITY_DIED, (data: { entity: string; drops: { itemId: string; quantity: number }[] }) => {
      for (const drop of data.drops) {
        this.inventory.addItem(drop.itemId, drop.quantity);
      }
      EventBus.emit(Events.SHOW_NOTIFICATION, {
        message: `${data.entity} defeated!`,
      });
    });
  }

  private handlePlayerAttack(): void {
    const zone = this.combatSystem.attack(this.playerFacing);
    if (!zone) return;

    for (const enemy of this.enemies) {
      if (enemy.isDead()) continue;
      this.physics.add.overlap(
        zone,
        enemy.sprite,
        () => {
          const damage = this.combatSystem.getAttackDamage(this.inventory);
          if (damage > 0) {
            enemy.takeDamage(damage);
          }
        },
        undefined,
        this
      );
    }
  }

  private checkEnemyAttacks(): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead()) continue;
      if (!enemy.canAttack()) continue;

      const dx = this.player.x - enemy.sprite.x;
      const dy = this.player.y - enemy.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= TILE_SIZE) {
        const config = enemy.getConfig();
        this.combatSystem.handlePlayerDamage(config.damage, {
          x: enemy.sprite.x,
          y: enemy.sprite.y,
        });
      }
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

    this.scene.launch('DialogueScene', {
      npc,
      llmClient: this.llmClient,
      worldState: this.worldState,
      storylineManager: this.storylineManager,
      onClose: () => {
        this.inDialogue = false;
        npc.isInDialogue = false;
        this.worldState.resume();
        EventBus.emit(Events.DIALOGUE_END, { npcId: npc.persona.id });
      },
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
}
