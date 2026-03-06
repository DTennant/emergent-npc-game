import {
  EpisodicMemory,
  SemanticMemory,
  SocialRelationship,
  MemoryContext,
  GossipPacket,
  SoulDocument,
  MemoryDocument,
  CharacterArcStage,
} from './types';
import { NPCPersona } from '../npc/personas';
import { GoalSystem } from '../npc/GoalSystem';
import { EventBus, Events } from '../world/EventBus';

let memoryIdCounter = 0;

export class MemoryManager {
  private episodicMemories: EpisodicMemory[] = [];
  private semanticMemories: Map<string, SemanticMemory> = new Map();
  private socialRelationships: Map<string, SocialRelationship> = new Map();
  private ownerId: string;
  private soulDocument: SoulDocument | null = null;
  private memoryDocument: MemoryDocument | null = null;
  private previousPlayerTrust = 0.5;

  constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  // --- Episodic Memory ---

  addEpisode(params: {
    day: number;
    gameTime: string;
    type: EpisodicMemory['type'];
    participants: string[];
    location: string;
    summary: string;
    emotionalValence?: number;
    importance?: number;
    tags?: string[];
  }): EpisodicMemory {
    const memory: EpisodicMemory = {
      id: `mem_${this.ownerId}_${++memoryIdCounter}`,
      timestamp: params.day,
      gameTime: params.gameTime,
      type: params.type,
      participants: params.participants,
      location: params.location,
      summary: params.summary,
      emotionalValence: params.emotionalValence ?? 0,
      importance: params.importance ?? 0.5,
      tags: params.tags ?? [],
      decayRate: 0.01,
      timesRecalled: 0,
    };

    this.episodicMemories.push(memory);
    EventBus.emit(Events.MEMORY_FORMED, { ownerId: this.ownerId, memory });
    return memory;
  }

  recallEpisodes(query: {
    participant?: string;
    tags?: string[];
    limit?: number;
    currentDay?: number;
  }): EpisodicMemory[] {
    let results = [...this.episodicMemories];

    if (query.participant) {
      results = results.filter((m) =>
        m.participants.includes(query.participant!)
      );
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter((m) =>
        query.tags!.some((t) => m.tags.includes(t))
      );
    }

    // Score by recency + importance
    const currentDay = query.currentDay ?? 1;
    results.sort((a, b) => {
      const scoreA =
        a.importance * Math.exp(-a.decayRate * (currentDay - a.timestamp));
      const scoreB =
        b.importance * Math.exp(-b.decayRate * (currentDay - b.timestamp));
      return scoreB - scoreA;
    });

    // Boost recall count
    const limit = query.limit ?? 5;
    const recalled = results.slice(0, limit);
    recalled.forEach((m) => {
      m.timesRecalled++;
      m.decayRate *= 0.95; // retrieval practice: slower decay
    });

    return recalled;
  }

  // --- Gossip Memory ---

  addGossipMemory(packet: GossipPacket): EpisodicMemory {
    return this.addEpisode({
      day: packet.timestamp,
      gameTime: '00:00',
      type: 'gossip',
      participants: [packet.from, packet.subject],
      location: 'village',
      summary: `${packet.from} said about ${packet.subject}: ${packet.content}`,
      emotionalValence: 0,
      importance: Math.max(0.1, 0.5 * packet.reliability),
      tags: ['gossip', packet.subject],
    });
  }

  getShareableMemories(currentDay: number, limit = 3): EpisodicMemory[] {
    const candidates = this.episodicMemories.filter(
      (m) => m.type !== 'gossip' && m.importance > 0.4
    );

    candidates.sort((a, b) => {
      const recencyA = Math.exp(-0.1 * (currentDay - a.timestamp));
      const recencyB = Math.exp(-0.1 * (currentDay - b.timestamp));
      return (recencyB * b.importance) - (recencyA * a.importance);
    });

    return candidates.slice(0, limit);
  }

  // --- Semantic Memory ---

  updateBelief(
    subject: string,
    fact: string,
    confidence: number,
    source: string,
    day: number
  ): void {
    let semantic = this.semanticMemories.get(subject);
    if (!semantic) {
      semantic = { subject, beliefs: [] };
      this.semanticMemories.set(subject, semantic);
    }

    const existing = semantic.beliefs.find((b) => b.fact === fact);
    if (existing) {
      // Update confidence with weighted average
      existing.confidence = existing.confidence * 0.4 + confidence * 0.6;
      existing.source = source;
      existing.lastUpdated = day;
    } else {
      semantic.beliefs.push({ fact, confidence, source, lastUpdated: day });
    }
  }

  getBeliefs(subject: string): SemanticMemory | undefined {
    return this.semanticMemories.get(subject);
  }

  // --- Social Memory ---

  getRelationship(targetId: string): SocialRelationship {
    let rel = this.socialRelationships.get(targetId);
    if (!rel) {
      rel = {
        targetId,
        trust: 0.5,
        affection: 0.3,
        familiarity: 0.0,
        notes: [],
        lastInteraction: 0,
      };
      this.socialRelationships.set(targetId, rel);
    }
    return rel;
  }

  updateRelationship(
    targetId: string,
    changes: {
      trustDelta?: number;
      affectionDelta?: number;
      note?: string;
      day?: number;
    }
  ): void {
    const rel = this.getRelationship(targetId);

    if (changes.trustDelta) {
      rel.trust = Math.max(0, Math.min(1, rel.trust + changes.trustDelta));
    }
    if (changes.affectionDelta) {
      rel.affection = Math.max(
        0,
        Math.min(1, rel.affection + changes.affectionDelta)
      );
    }
    if (changes.note) {
      rel.notes.push(changes.note);
      if (rel.notes.length > 10) rel.notes.shift();
    }
    if (changes.day) {
      rel.lastInteraction = changes.day;
    }

    // Familiarity increases with each interaction
    rel.familiarity = Math.min(1, rel.familiarity + 0.05);
  }

  // --- Context Building ---

  buildContext(
    aboutSubject: string,
    currentDay: number
  ): MemoryContext {
    return {
      recentEpisodes: this.recallEpisodes({
        participant: aboutSubject,
        currentDay,
        limit: 5,
      }),
      relevantBeliefs: this.getBeliefs(aboutSubject)?.beliefs ?? [],
      relationship: this.socialRelationships.get(aboutSubject) ?? null,
    };
  }

  // --- Soul & Memory Documents ---

  generateSoulDocument(persona: NPCPersona): SoulDocument {
    const identity = `${persona.name} is a ${persona.age}-year-old ${persona.role.toLowerCase()} ` +
      `who values ${persona.values.slice(0, 2).join(' and ')} above all else.`;

    this.soulDocument = {
      name: persona.name,
      role: persona.role,
      age: persona.age,
      personality: persona.personality,
      speechStyle: persona.speechStyle,
      backstory: persona.backstory,
      values: [...persona.values],
      fears: [...persona.fears],
      coreIdentity: identity,
    };

    return this.soulDocument;
  }

  getSoulDocument(): SoulDocument | null {
    return this.soulDocument;
  }

  updateMemoryDocument(currentDay: number): MemoryDocument {
    const playerRel = this.socialRelationships.get('player');
    let relationshipSummary = 'No significant relationships with the player yet.';
    if (playerRel && playerRel.familiarity > 0) {
      const interactionCount = this.episodicMemories.filter(
        (m) => m.participants.includes('player')
      ).length;
      relationshipSummary = `Met the player ${Math.ceil(interactionCount / 2)} time(s). ` +
        `Trust: ${(playerRel.trust * 100).toFixed(0)}%, ` +
        `Affection: ${(playerRel.affection * 100).toFixed(0)}%, ` +
        `Familiarity: ${(playerRel.familiarity * 100).toFixed(0)}%.`;
      if (playerRel.notes.length > 0) {
        relationshipSummary += ` Notes: ${playerRel.notes.slice(-3).join('; ')}.`;
      }
    }

    const significantEvents = this.episodicMemories
      .filter((m) => m.importance >= 0.5)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10)
      .map((m) => `Day ${m.timestamp} - ${m.summary}`);

    const evolvingBeliefs: string[] = [];
    for (const [, semantic] of this.semanticMemories) {
      for (const belief of semantic.beliefs) {
        evolvingBeliefs.push(
          `${belief.fact} (confidence: ${(belief.confidence * 100).toFixed(0)}%)`
        );
      }
    }

    const newArc = this.evaluateCharacterArc(currentDay);
    const existingArc = this.memoryDocument?.characterArc ?? 'opening';
    const arcChanged = newArc !== existingArc;

    this.memoryDocument = {
      lastUpdated: currentDay,
      relationshipSummary,
      significantEvents,
      evolvingBeliefs: evolvingBeliefs.slice(0, 10),
      characterArc: newArc,
      arcNarrative: arcChanged
        ? this.generateArcNarrative(newArc)
        : (this.memoryDocument?.arcNarrative ?? this.generateArcNarrative(newArc)),
    };

    return this.memoryDocument;
  }

  getMemoryDocument(): MemoryDocument | null {
    return this.memoryDocument;
  }

  private evaluateCharacterArc(currentDay: number): CharacterArcStage {
    const playerRel = this.socialRelationships.get('player');
    const trustShift = playerRel
      ? Math.abs(playerRel.trust - this.previousPlayerTrust)
      : 0;

    const highImportanceEvents = this.episodicMemories.filter(
      (m) => m.importance > 0.8
    ).length;

    let beliefUpdateCount = 0;
    for (const [, semantic] of this.semanticMemories) {
      beliefUpdateCount += semantic.beliefs.length;
    }

    const interactionCount = this.episodicMemories.filter(
      (m) => m.participants.includes('player')
    ).length;

    if (trustShift > 0.2 || highImportanceEvents >= 3) {
      if (currentDay > 5 && beliefUpdateCount >= 5) {
        return 'resolution';
      }
      return 'turning_point';
    }

    if (interactionCount >= 4 || beliefUpdateCount >= 2) {
      return 'developing';
    }

    return 'opening';
  }

  private generateArcNarrative(stage: CharacterArcStage): string {
    const soul = this.soulDocument;
    const name = soul?.name ?? 'This NPC';
    const role = soul?.role?.toLowerCase() ?? 'villager';

    switch (stage) {
      case 'opening':
        return `${name} remains as they have always been — a ${role} following familiar routines, not yet touched by the winds of change.`;
      case 'developing':
        return `${name} has begun forming new connections and questioning old assumptions. The ${role}'s worldview is expanding through recent interactions.`;
      case 'turning_point':
        return `A significant event has shaken ${name}'s perspective. The ${role} is reassessing what matters most and what they are willing to do about it.`;
      case 'resolution':
        return `${name} has reached a new understanding. The ${role} has been transformed by their experiences and found a renewed sense of purpose.`;
    }
  }

  getFullMemoryNarrative(currentDay: number, goalSystem?: GoalSystem): string {
    const soul = this.soulDocument;
    const memDoc = this.updateMemoryDocument(currentDay);
    const sections: string[] = [];

    // WHO I AM
    if (soul) {
      let whoIAm = `## WHO I AM\n`;
      whoIAm += `I am ${soul.name}, the village ${soul.role.toLowerCase()}. `;
      whoIAm += `I am ${soul.age} years old. ${soul.personality}\n`;
      whoIAm += `I speak in this style: ${soul.speechStyle}\n`;
      whoIAm += `My story: ${soul.backstory}\n`;
      whoIAm += `I value: ${soul.values.join(', ')}. `;
      whoIAm += `I fear: ${soul.fears.join(', ')}.`;
      sections.push(whoIAm);
    }

    // WHAT I REMEMBER
    let whatIRemember = `## WHAT I REMEMBER\n`;
    whatIRemember += memDoc.relationshipSummary;
    if (memDoc.significantEvents.length > 0) {
      whatIRemember += `\nKey events: ${memDoc.significantEvents.join('. ')}.`;
    }
    if (memDoc.evolvingBeliefs.length > 0) {
      whatIRemember += `\nMy beliefs: ${memDoc.evolvingBeliefs.join('. ')}.`;
    }
    sections.push(whatIRemember);

    // MY CURRENT JOURNEY
    let journey = `## MY CURRENT JOURNEY\n`;
    journey += memDoc.arcNarrative;
    journey += ` I am in the "${memDoc.characterArc}" stage of my arc.`;
    sections.push(journey);

    // MY GOALS
    if (goalSystem) {
      const goalSummary = goalSystem.getGoalSummary();
      if (goalSummary) {
        sections.push(`## MY GOALS\n${goalSummary}`);
      }
    }

    return sections.join('\n\n');
  }

  trackPlayerTrust(): void {
    const playerRel = this.socialRelationships.get('player');
    if (playerRel) {
      this.previousPlayerTrust = playerRel.trust;
    }
  }

  // --- Persistent Memory (localStorage) ---

  savePersistentMemory(npcId: string): void {
    try {
      const data = {
        soul: this.soulDocument,
        memoryDoc: this.memoryDocument,
        previousPlayerTrust: this.previousPlayerTrust,
      };
      localStorage.setItem(`npc_persistent_${npcId}`, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed to save persistent memory for ${npcId}:`, e);
    }
  }

  loadPersistentMemory(npcId: string): void {
    try {
      const raw = localStorage.getItem(`npc_persistent_${npcId}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.soul) this.soulDocument = data.soul;
      if (data.memoryDoc) this.memoryDocument = data.memoryDoc;
      if (typeof data.previousPlayerTrust === 'number') {
        this.previousPlayerTrust = data.previousPlayerTrust;
      }
    } catch (e) {
      console.error(`Failed to load persistent memory for ${npcId}:`, e);
    }
  }

  // --- Serialization ---

  toJSON(): object {
    return {
      ownerId: this.ownerId,
      episodic: this.episodicMemories,
      semantic: Object.fromEntries(this.semanticMemories),
      social: Object.fromEntries(this.socialRelationships),
      soul: this.soulDocument,
      memoryDoc: this.memoryDocument,
      previousPlayerTrust: this.previousPlayerTrust,
    };
  }

  fromJSON(data: {
    ownerId: string;
    episodic: EpisodicMemory[];
    semantic: Record<string, SemanticMemory>;
    social: Record<string, SocialRelationship>;
    soul?: SoulDocument | null;
    memoryDoc?: MemoryDocument | null;
    previousPlayerTrust?: number;
  }): void {
    this.episodicMemories = data.episodic.map((e) => ({ ...e }));
    this.semanticMemories = new Map(Object.entries(data.semantic));
    this.socialRelationships = new Map(Object.entries(data.social));
    this.soulDocument = data.soul ?? null;
    this.memoryDocument = data.memoryDoc ?? null;
    this.previousPlayerTrust = data.previousPlayerTrust ?? 0.5;

    let maxId = 0;
    for (const ep of this.episodicMemories) {
      const match = ep.id.match(/_(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    }
    memoryIdCounter = Math.max(memoryIdCounter, maxId);
  }
}
