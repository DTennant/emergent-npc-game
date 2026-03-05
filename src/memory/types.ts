export interface EpisodicMemory {
  id: string;
  timestamp: number; // game day
  gameTime: string; // e.g. "14:30"
  type: 'interaction' | 'observation' | 'gossip' | 'event';
  participants: string[];
  location: string;
  summary: string;
  emotionalValence: number; // -1 to 1
  importance: number; // 0 to 1
  tags: string[];
  decayRate: number;
  timesRecalled: number;
}

export interface SemanticBelief {
  fact: string;
  confidence: number; // 0 to 1
  source: string;
  lastUpdated: number; // game day
}

export interface SemanticMemory {
  subject: string;
  beliefs: SemanticBelief[];
}

export interface SocialRelationship {
  targetId: string;
  trust: number; // 0 to 1
  affection: number; // 0 to 1
  familiarity: number; // 0 to 1
  notes: string[];
  lastInteraction: number; // game day
}

export interface MemoryContext {
  recentEpisodes: EpisodicMemory[];
  relevantBeliefs: SemanticBelief[];
  relationship: SocialRelationship | null;
}
