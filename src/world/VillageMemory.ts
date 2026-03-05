import { EventBus, Events } from './EventBus';

export interface VillageEvent {
  id: string;
  description: string;
  day: number;
  knownBy: string[];
  impact: 'positive' | 'negative' | 'neutral';
  category: 'player_action' | 'world_event' | 'npc_event';
}

export interface VillageMemoryJSON {
  events: VillageEvent[];
  nextEventId: number;
  collectiveBeliefs: [string, { belief: string; confidence: number }][];
}

export class VillageMemory {
  private events: VillageEvent[] = [];
  private nextEventId = 0;
  private collectiveBeliefs: Map<string, { belief: string; confidence: number }> = new Map();

  addEvent(event: Omit<VillageEvent, 'id'>): void {
    const villageEvent: VillageEvent = {
      ...event,
      id: `ve_${this.nextEventId++}`,
    };
    this.events.push(villageEvent);
    EventBus.emit(Events.VILLAGE_EVENT, villageEvent);
  }

  promoteFromGossip(subject: string, content: string, knownByNPCs: string[], day: number): void {
    if (knownByNPCs.length < 3) return;

    const alreadyExists = this.events.some(
      (e) => e.description === content && e.knownBy.length >= knownByNPCs.length
    );
    if (alreadyExists) return;

    const impact = this.inferImpact(content);
    const category = subject === 'player' ? 'player_action' : 'npc_event';

    this.addEvent({
      description: content,
      day,
      knownBy: [...knownByNPCs],
      impact,
      category,
    });

    const beliefKey = `about_${subject}`;
    const existing = this.collectiveBeliefs.get(beliefKey);
    const confidence = Math.min(1, knownByNPCs.length / 6);
    if (!existing || confidence > existing.confidence) {
      this.collectiveBeliefs.set(beliefKey, { belief: content, confidence });
    }
  }

  getReputationSummary(subjectId: string): string {
    const subjectEvents = this.events.filter(
      (e) => e.description.toLowerCase().includes(subjectId.toLowerCase()) ||
        e.knownBy.includes(subjectId)
    );

    if (subjectEvents.length === 0) {
      return 'The village has no strong opinion yet.';
    }

    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const event of subjectEvents) {
      if (event.impact === 'positive') positive++;
      else if (event.impact === 'negative') negative++;
      else neutral++;
    }

    const total = positive + negative + neutral;

    if (positive > negative * 2) {
      return 'The village views you favorably. Your good deeds are well known.';
    } else if (negative > positive * 2) {
      return 'The village is deeply suspicious of you. Negative rumors abound.';
    } else if (negative > positive) {
      return 'Some villagers are suspicious of you.';
    } else if (positive > negative) {
      return 'The village generally regards you well, though opinions vary.';
    } else if (total > 0) {
      return 'The village has mixed feelings about you.';
    }

    return 'The village has no strong opinion yet.';
  }

  getRecentEvents(limit?: number): VillageEvent[] {
    const sorted = [...this.events].sort((a, b) => b.day - a.day);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getCollectiveBeliefsString(): string {
    if (this.collectiveBeliefs.size === 0) return '';

    const lines: string[] = ['Village collective knowledge:'];
    for (const [key, value] of this.collectiveBeliefs) {
      const confidence = Math.round(value.confidence * 100);
      lines.push(`- ${value.belief} (${confidence}% of village aware)`);
    }
    return lines.join('\n');
  }

  toJSON(): VillageMemoryJSON {
    return {
      events: this.events.map((e) => ({ ...e, knownBy: [...e.knownBy] })),
      nextEventId: this.nextEventId,
      collectiveBeliefs: Array.from(this.collectiveBeliefs.entries()),
    };
  }

  fromJSON(data: VillageMemoryJSON): void {
    this.events = data.events.map((e) => ({ ...e, knownBy: [...e.knownBy] }));
    this.nextEventId = data.nextEventId;
    this.collectiveBeliefs = new Map(data.collectiveBeliefs);
  }

  private inferImpact(content: string): 'positive' | 'negative' | 'neutral' {
    const lower = content.toLowerCase();
    const positiveWords = ['help', 'kind', 'generous', 'save', 'protect', 'gift', 'heal', 'brave', 'friend'];
    const negativeWords = ['steal', 'attack', 'threat', 'rude', 'destroy', 'harm', 'lie', 'cheat', 'suspicious'];

    const posScore = positiveWords.filter((w) => lower.includes(w)).length;
    const negScore = negativeWords.filter((w) => lower.includes(w)).length;

    if (posScore > negScore) return 'positive';
    if (negScore > posScore) return 'negative';
    return 'neutral';
  }
}
