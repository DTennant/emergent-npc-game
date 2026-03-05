import {
  EpisodicMemory,
  SemanticMemory,
  SocialRelationship,
  MemoryContext,
  GossipPacket,
} from './types';
import { EventBus, Events } from '../world/EventBus';

let memoryIdCounter = 0;

export class MemoryManager {
  private episodicMemories: EpisodicMemory[] = [];
  private semanticMemories: Map<string, SemanticMemory> = new Map();
  private socialRelationships: Map<string, SocialRelationship> = new Map();
  private ownerId: string;

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

  // --- Serialization ---

  toJSON(): object {
    return {
      ownerId: this.ownerId,
      episodic: this.episodicMemories,
      semantic: Object.fromEntries(this.semanticMemories),
      social: Object.fromEntries(this.socialRelationships),
    };
  }

  fromJSON(data: {
    ownerId: string;
    episodic: EpisodicMemory[];
    semantic: Record<string, SemanticMemory>;
    social: Record<string, SocialRelationship>;
  }): void {
    this.episodicMemories = data.episodic.map((e) => ({ ...e }));
    this.semanticMemories = new Map(Object.entries(data.semantic));
    this.socialRelationships = new Map(Object.entries(data.social));

    // Restore memoryIdCounter to avoid ID collisions
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
