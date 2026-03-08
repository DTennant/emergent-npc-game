import { NPC } from './NPC';
import { GossipPacket } from '../memory/types';
import { EventBus, Events } from '../world/EventBus';
import { GOSSIP_RANGE, GOSSIP_INTERVAL_MS } from '../config';

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'blacksmith_erik': ['forge', 'metal', 'weapon', 'sword', 'armor', 'iron', 'craft', 'fight', 'combat'],
  'innkeeper_rose': ['village', 'gossip', 'rumor', 'visitor', 'social', 'news', 'story', 'friend'],
  'merchant_anna': ['trade', 'gold', 'price', 'buy', 'sell', 'merchant', 'goods', 'rare', 'material'],
  'farmer_thomas': ['farm', 'crop', 'harvest', 'weather', 'food', 'provision', 'land', 'grow'],
  'guard_marcus': ['patrol', 'danger', 'wolf', 'blight', 'protect', 'guard', 'threat', 'forest', 'attack'],
  'herbalist_willow': ['herb', 'potion', 'plant', 'moonpetal', 'heal', 'nature', 'forest', 'brew'],
};

export class GossipSystem {
  private npcs: NPC[];
  private timer = 0;
  private sharedMemories: Map<string, Set<string>> = new Map();

  constructor(npcs: NPC[]) {
    this.npcs = npcs;
  }

  update(delta: number, currentDay: number): void {
    this.timer += delta;
    if (this.timer < GOSSIP_INTERVAL_MS) return;
    this.timer = 0;

    for (let i = 0; i < this.npcs.length; i++) {
      for (let j = i + 1; j < this.npcs.length; j++) {
        const npcA = this.npcs[i];
        const npcB = this.npcs[j];

        if (npcA.isInDialogue || npcB.isInDialogue) continue;

        const posA = npcA.getPosition();
        const posB = npcB.getPosition();
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > GOSSIP_RANGE) continue;

        this.tryGossip(npcA, npcB, currentDay);
        this.tryGossip(npcB, npcA, currentDay);
      }
    }
  }

  private tryGossip(sender: NPC, receiver: NPC, currentDay: number): void {
    const gossipChance = this.calculateGossipProbability(sender, receiver);
    if (Math.random() > gossipChance) return;

    const memories = sender.memory.getShareableMemories(currentDay);
    if (memories.length === 0) return;

    const pairKey = `${sender.persona.id}->${receiver.persona.id}`;
    const shared = this.sharedMemories.get(pairKey) ?? new Set<string>();

    const unsharedMemories = memories.filter((m) => !shared.has(m.id));
    if (unsharedMemories.length === 0) return;

    const keywords = TOPIC_KEYWORDS[receiver.persona.id] || [];
    const scored = unsharedMemories.map(m => {
      const content = m.summary.toLowerCase();
      const score = keywords.reduce((s, kw) => s + (content.includes(kw) ? 1 : 0), 0);
      return { memory: m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const unshard = scored[0].memory;

    shared.add(unshard.id);
    this.sharedMemories.set(pairKey, shared);

    const hops = unshard.tags.includes('gossip') ? 1 : 0;
    const reliability = Math.max(0, 0.8 - hops * 0.2);

    const packet: GossipPacket = {
      from: sender.persona.name,
      to: receiver.persona.name,
      subject: unshard.participants[0] ?? 'unknown',
      content: unshard.summary,
      reliability,
      originalSource: sender.persona.name,
      hops: hops + 1,
      timestamp: currentDay,
    };

    receiver.memory.addGossipMemory(packet);
    EventBus.emit(Events.NPC_GOSSIP, packet);
  }

  private calculateGossipProbability(sender: NPC, receiver: NPC): number {
    const isExtraverted = sender.persona.personality
      .toLowerCase()
      .includes('high extraversion');
    const extraversionBonus = isExtraverted ? 0.3 : 0.0;

    const relationship = sender.memory.getRelationship(receiver.persona.id);
    const trustBonus = relationship.trust * 0.4;

    const moodMod = sender.getMoodModifier();
    return Math.min(1, (0.1 + extraversionBonus + trustBonus) * moodMod);
  }
}
