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

export interface LLMResponse {
  dialogue: string;
  internal_thought: string;
  mood_change: number;       // -1 to 1
  action: string | null;
  memory_to_store: string;
  belief_update: string | null;
}

export type CharacterArcStage = 'opening' | 'developing' | 'turning_point' | 'resolution';

export interface SoulDocument {
  name: string;
  role: string;
  age: number;
  personality: string;
  speechStyle: string;
  backstory: string;
  values: string[];
  fears: string[];
  coreIdentity: string; // A 1-2 sentence distilled identity statement
}

export interface MemoryDocument {
  lastUpdated: number; // game day
  relationshipSummary: string; // Prose summary of key relationships
  significantEvents: string[]; // Most impactful events (max 10)
  evolvingBeliefs: string[]; // Beliefs that have changed over time
  characterArc: CharacterArcStage; // Current arc stage
  arcNarrative: string; // 1-2 sentences describing NPC's current character journey
}

export interface NPCGoal {
  id: string;
  description: string;
  priority: number; // 1-5
  status: 'active' | 'completed' | 'failed' | 'blocked';
  progress: number; // 0 to 1
  blockedReason?: string;
}

export interface GossipPacket {
  from: string;
  to: string;
  subject: string;
  content: string;
  reliability: number; // 0 to 1, degrades with each hop
  originalSource: string;
  hops: number;
  timestamp: number; // game day
}
