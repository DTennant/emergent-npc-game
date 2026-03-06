import Phaser from 'phaser';
import { NPCPersona } from './personas';
import { GoalSystem } from './GoalSystem';
import { MemoryManager } from '../memory/MemoryManager';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { LLMResponse } from '../memory/types';
import { GAME_WIDTH, GAME_HEIGHT, NPC_SPEED, TILE_SIZE } from '../config';
import { EventBus, Events } from '../world/EventBus';
import { QuestGateChecker } from '../quest/QuestGates';
import { StorylineManager } from '../story/StorylineManager';
import { NPC_TEXTURE_MAP } from '../assets/keys';

export class NPC {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public nameTag: Phaser.GameObjects.Text;
  public persona: NPCPersona;
  public memory: MemoryManager;
  public goals: GoalSystem;
  public isInDialogue = false;

  private scene: Phaser.Scene;
  private mood = 0.6; // 0 to 1, slightly positive initial mood
  private moodIndicator!: Phaser.GameObjects.Rectangle;
  private moodUpdateTimer = 0;
  private wanderTimer = 0;
  private wanderTarget: { x: number; y: number } | null = null;
  private currentActivity = 'idle';

  constructor(scene: Phaser.Scene, persona: NPCPersona) {
    this.scene = scene;
    this.persona = persona;
    this.memory = new MemoryManager(persona.id);
    this.goals = new GoalSystem(persona.startingGoals);

    for (const [targetId, rel] of Object.entries(persona.initialRelationships)) {
      this.memory.updateRelationship(targetId, {
        trustDelta: rel.trust - 0.5,
        affectionDelta: rel.affection - 0.3,
        note: rel.notes[0],
        day: 0,
      });
    }

    this.memory.loadPersistentMemory(persona.id);
    if (!this.memory.getSoulDocument()) {
      this.memory.generateSoulDocument(persona);
    }

    const textureKey = NPC_TEXTURE_MAP[persona.id] ?? 'npc_blacksmith';

    this.sprite = scene.physics.add.sprite(
      persona.workPosition.x,
      persona.workPosition.y,
      textureKey
    );
    this.sprite.setDepth(5);
    this.sprite.setCollideWorldBounds(true);

    this.nameTag = scene.add.text(
      persona.workPosition.x,
      persona.workPosition.y - TILE_SIZE * 0.7,
      persona.name,
      {
        fontSize: '11px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        resolution: window.devicePixelRatio,
      }
    );
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(6);

    this.moodIndicator = scene.add.rectangle(
      persona.workPosition.x,
      persona.workPosition.y - TILE_SIZE * 0.7 - 8,
      6,
      6,
      this.getMoodColor()
    );
    this.moodIndicator.setDepth(7);
  }

  update(delta: number, worldState: WorldState): void {
    if (this.isInDialogue) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    const hour = worldState.getHour().toString();
    const scheduledActivity = this.persona.schedule[hour];
    if (scheduledActivity && scheduledActivity !== this.currentActivity) {
      this.currentActivity = scheduledActivity;
      this.onActivityChange(scheduledActivity);
    }

    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.pickWanderTarget();
      this.wanderTimer = 2000 + Math.random() * 4000;
    }

    if (this.wanderTarget) {
      this.moveToward(this.wanderTarget);
    } else {
      this.sprite.setVelocity(0, 0);
      this.sprite.anims?.stop();
      this.sprite.setFrame(0);
    }

    this.mood += (0.5 - this.mood) * 0.0001 * delta;
    this.moodUpdateTimer += delta;
    if (this.moodUpdateTimer >= 2000) {
      this.updateMoodIndicator();
      this.moodUpdateTimer = 0;
    }

    this.nameTag.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE * 0.7);
    this.moodIndicator.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE * 0.7 - 8);
  }

  private onActivityChange(activity: string): void {
    if (activity === 'sleep' || activity.includes('home')) {
      this.wanderTarget = { ...this.persona.homePosition };
    } else if (activity.includes('inn') || activity === 'dinner') {
      this.wanderTarget = { x: 720, y: 320 };
    } else {
      this.wanderTarget = { ...this.persona.workPosition };
    }
  }

  private pickWanderTarget(): void {
    const range = TILE_SIZE * 3;
    const baseX = this.wanderTarget?.x ?? this.persona.workPosition.x;
    const baseY = this.wanderTarget?.y ?? this.persona.workPosition.y;

    this.wanderTarget = {
      x: baseX + (Math.random() - 0.5) * range,
      y: baseY + (Math.random() - 0.5) * range,
    };

    this.wanderTarget.x = Math.max(40, Math.min(GAME_WIDTH - 40, this.wanderTarget.x));
    this.wanderTarget.y = Math.max(40, Math.min(GAME_HEIGHT - 40, this.wanderTarget.y));
  }

  private moveToward(target: { x: number; y: number }): void {
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.sprite.setVelocity(0, 0);
      this.sprite.anims?.stop();
      this.sprite.setFrame(0);
      this.wanderTarget = null;
      return;
    }

    const vx = (dx / dist) * NPC_SPEED;
    const vy = (dy / dist) * NPC_SPEED;
    this.sprite.setVelocity(vx, vy);

    const facing = Math.abs(dx) >= Math.abs(dy) 
      ? (dx > 0 ? 'right' : 'left') 
      : (dy > 0 ? 'down' : 'up');
    
    const textureKey = this.sprite.texture.key;
    const animKey = `${textureKey}_walk_${facing}`;
    if (this.sprite.anims && this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.anims.play(animKey, true);
    }
  }

  async generateResponse(
    llmClient: LLMClient,
    playerMessage: string,
    worldState: WorldState,
    storylineManager?: StorylineManager
  ): Promise<LLMResponse> {
    const day = worldState.getDay();
    const memoryContext = this.memory.buildContext('player', day);

    let worldContext = `Day ${day}, ${worldState.getTimeString()} (${worldState.getDayTimeLabel()}). Village: ${worldState.village.name}, prosperity ${(worldState.village.prosperity * 100).toFixed(0)}%. Your current mood: ${this.getMoodLabel()} (${this.mood.toFixed(2)}).`;
    if (worldState.worldFacts.length > 0) {
      worldContext += ` Known facts: ${worldState.worldFacts.join('; ')}.`;
    }

    const playerRelationship = this.memory.getRelationship('player');
    const npcGates = QuestGateChecker.getGatesForNPC(this.persona.id);
    if (npcGates.length > 0) {
      const gateLines: string[] = [];
      for (const gate of npcGates) {
        const status = QuestGateChecker.getGateStatus(
          this.persona.id,
          gate.questId,
          playerRelationship.trust,
          playerRelationship.familiarity
        );
        if (status.canHelp) {
          gateLines.push(`You trust the player enough to help with: ${gate.description}`);
        } else {
          gateLines.push(`You don't yet trust the player enough to help with: ${gate.description} (you need to know them better)`);
        }
      }
      worldContext += ` ${gateLines.join('. ')}.`;
    }

    if (storylineManager) {
      const questContext = storylineManager.getQuestContextForNPC(
        this.persona.id,
        playerRelationship.trust,
        playerRelationship.familiarity
      );
      if (questContext) {
        worldContext += ` ${questContext}`;
      }
    }

    this.memory.addEpisode({
      day,
      gameTime: worldState.getTimeString(),
      type: 'interaction',
      participants: ['player'],
      location: 'village',
      summary: `Player said: "${playerMessage}"`,
      emotionalValence: 0.1,
      importance: 0.5,
      tags: ['player', 'dialogue'],
    });

    this.memory.updateRelationship('player', {
      trustDelta: 0.03,
      affectionDelta: 0.02,
      note: `Talked on day ${day}`,
      day,
    });

    const fullMemoryNarrative = this.memory.getFullMemoryNarrative(day, this.goals);
    this.memory.trackPlayerTrust();

    const response = await llmClient.generateDialogue(
      {
        name: this.persona.name,
        role: this.persona.role,
        speechStyle: this.persona.speechStyle,
        personality: this.persona.personality,
        backstory: this.persona.backstory,
      },
      memoryContext,
      playerMessage,
      worldContext,
      fullMemoryNarrative
    );

    this.mood = Math.max(0, Math.min(1, this.mood + response.mood_change * 0.1));
    this.updateMoodIndicator();
    EventBus.emit(Events.NPC_MOOD_CHANGE, {
      npcId: this.persona.id,
      mood: this.mood,
      label: this.getMoodLabel(),
    });

    this.memory.addEpisode({
      day,
      gameTime: worldState.getTimeString(),
      type: 'interaction',
      participants: ['player'],
      location: 'village',
      summary: response.memory_to_store,
      emotionalValence: response.mood_change,
      importance: 0.3,
      tags: ['player', 'dialogue', 'self'],
    });

    if (response.belief_update) {
      this.memory.updateBelief(
        'player',
        response.belief_update,
        0.7,
        'interaction',
        day
      );
    }

    const activeGoals = this.goals.getActiveGoals();
    for (const goal of activeGoals) {
      this.goals.updateGoalProgress(goal.id, goal.progress + 0.05);
    }

    this.memory.savePersistentMemory(this.persona.id);

    return response;
  }

  getMood(): number {
    return this.mood;
  }

  getMoodLabel(): string {
    if (this.mood < 0.2) return 'miserable';
    if (this.mood < 0.35) return 'unhappy';
    if (this.mood < 0.45) return 'discontent';
    if (this.mood < 0.55) return 'content';
    if (this.mood < 0.7) return 'happy';
    if (this.mood < 0.85) return 'joyful';
    return 'elated';
  }

  private getMoodColor(): number {
    if (this.mood < 0.3) return 0xff0000;
    if (this.mood < 0.45) return 0xff8800;
    if (this.mood < 0.55) return 0xffff00;
    if (this.mood < 0.7) return 0x88ff00;
    return 0x00ff00;
  }

  private updateMoodIndicator(): void {
    this.moodIndicator.setFillStyle(this.getMoodColor());
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  distanceTo(x: number, y: number): number {
    const dx = this.sprite.x - x;
    const dy = this.sprite.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
    this.moodIndicator.destroy();
  }
}
