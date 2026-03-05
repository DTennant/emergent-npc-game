import Phaser from 'phaser';
import { NPCPersona } from './personas';
import { MemoryManager } from '../memory/MemoryManager';
import { LLMClient } from '../ai/LLMClient';
import { WorldState } from '../world/WorldState';
import { NPC_SPEED, TILE_SIZE } from '../config';

export class NPC {
  public sprite: Phaser.GameObjects.Rectangle;
  public nameTag: Phaser.GameObjects.Text;
  public persona: NPCPersona;
  public memory: MemoryManager;
  public isInDialogue = false;

  private scene: Phaser.Scene;
  private wanderTimer = 0;
  private wanderTarget: { x: number; y: number } | null = null;
  private currentActivity = 'idle';

  constructor(scene: Phaser.Scene, persona: NPCPersona) {
    this.scene = scene;
    this.persona = persona;
    this.memory = new MemoryManager(persona.id);

    // Initialize relationships from persona
    for (const [targetId, rel] of Object.entries(persona.initialRelationships)) {
      this.memory.updateRelationship(targetId, {
        trustDelta: rel.trust - 0.5,
        affectionDelta: rel.affection - 0.3,
        note: rel.notes[0],
        day: 0,
      });
    }

    // Create sprite (colored rectangle)
    this.sprite = scene.add.rectangle(
      persona.workPosition.x,
      persona.workPosition.y,
      TILE_SIZE * 0.8,
      TILE_SIZE * 0.8,
      persona.color
    );
    this.sprite.setStrokeStyle(2, 0xffffff, 0.5);
    this.sprite.setDepth(5);

    // Name tag
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
      }
    );
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(6);
  }

  update(delta: number, worldState: WorldState): void {
    if (this.isInDialogue) return;

    // Update schedule-based activity
    const hour = worldState.getHour().toString();
    const scheduledActivity = this.persona.schedule[hour];
    if (scheduledActivity && scheduledActivity !== this.currentActivity) {
      this.currentActivity = scheduledActivity;
      this.onActivityChange(scheduledActivity);
    }

    // Wander behavior
    this.wanderTimer -= delta;
    if (this.wanderTimer <= 0) {
      this.pickWanderTarget();
      this.wanderTimer = 2000 + Math.random() * 4000;
    }

    if (this.wanderTarget) {
      this.moveToward(this.wanderTarget, delta);
    }

    // Update name tag position
    this.nameTag.setPosition(this.sprite.x, this.sprite.y - TILE_SIZE * 0.7);
  }

  private onActivityChange(activity: string): void {
    // Move toward relevant position based on activity
    if (activity === 'sleep' || activity.includes('home')) {
      this.wanderTarget = { ...this.persona.homePosition };
    } else if (activity.includes('inn') || activity === 'dinner') {
      this.wanderTarget = { x: 450, y: 200 }; // Inn position
    } else {
      this.wanderTarget = { ...this.persona.workPosition };
    }
  }

  private pickWanderTarget(): void {
    // Wander near current position
    const range = TILE_SIZE * 3;
    const baseX = this.wanderTarget?.x ?? this.persona.workPosition.x;
    const baseY = this.wanderTarget?.y ?? this.persona.workPosition.y;

    this.wanderTarget = {
      x: baseX + (Math.random() - 0.5) * range,
      y: baseY + (Math.random() - 0.5) * range,
    };

    // Clamp to world bounds
    this.wanderTarget.x = Math.max(40, Math.min(760, this.wanderTarget.x));
    this.wanderTarget.y = Math.max(40, Math.min(560, this.wanderTarget.y));
  }

  private moveToward(target: { x: number; y: number }, delta: number): void {
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.wanderTarget = null;
      return;
    }

    const speed = NPC_SPEED * (delta / 1000);
    const moveX = (dx / dist) * Math.min(speed, dist);
    const moveY = (dy / dist) * Math.min(speed, dist);

    this.sprite.x += moveX;
    this.sprite.y += moveY;
  }

  async generateResponse(
    llmClient: LLMClient,
    playerMessage: string,
    worldState: WorldState
  ): Promise<string> {
    const day = worldState.getDay();
    const memoryContext = this.memory.buildContext('player', day);

    const worldContext = `Day ${day}, ${worldState.getTimeString()} (${worldState.getDayTimeLabel()}). Village: ${worldState.village.name}, prosperity ${(worldState.village.prosperity * 100).toFixed(0)}%.`;

    // Record this interaction in memory
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

    // Update relationship
    this.memory.updateRelationship('player', {
      note: `Talked on day ${day}`,
      day,
    });

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
      worldContext
    );

    // Record own response
    this.memory.addEpisode({
      day,
      gameTime: worldState.getTimeString(),
      type: 'interaction',
      participants: ['player'],
      location: 'village',
      summary: `I responded: "${response}"`,
      emotionalValence: 0.1,
      importance: 0.3,
      tags: ['player', 'dialogue', 'self'],
    });

    return response;
  }

  distanceTo(x: number, y: number): number {
    const dx = this.sprite.x - x;
    const dy = this.sprite.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
  }
}
