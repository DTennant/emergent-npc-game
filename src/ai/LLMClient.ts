import { MemoryContext } from '../memory/types';

interface LLMRequest {
  messages: { role: string; content: string }[];
  resolve: (response: string) => void;
  reject: (error: Error) => void;
}

const FALLBACK_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Good day to you, traveler.",
    "Ah, hello there. What brings you here?",
    "Welcome! Haven't seen you around much.",
    "Well met, friend.",
  ],
  busy: [
    "I'm a bit occupied right now, come back later.",
    "Can't talk long, got work to do.",
    "Make it quick, I've got things to attend to.",
  ],
  friendly: [
    "It's always good to see you! How have you been?",
    "Ah, my favorite visitor! What can I do for you?",
    "I was just thinking about you. Strange, isn't it?",
  ],
  suspicious: [
    "What do you want now?",
    "I've got my eye on you...",
    "Hmm. State your business.",
  ],
  default: [
    "Interesting...",
    "I see. Tell me more.",
    "That's something to think about.",
    "Life in Thornwick keeps surprising me.",
  ],
};

export class LLMClient {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.openai.com/v1';
  private model = 'gpt-4o-mini';
  private queue: LLMRequest[] = [];
  private processing = false;
  private maxConcurrent = 2;
  private activeRequests = 0;

  constructor() {
    // Try to load API key from localStorage
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('openai_api_key');
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    if (typeof window !== 'undefined') {
      localStorage.setItem('openai_api_key', key);
    }
  }

  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  async generateDialogue(
    npcPersona: {
      name: string;
      role: string;
      speechStyle: string;
      personality: string;
      backstory: string;
    },
    memoryContext: MemoryContext,
    playerMessage: string,
    worldContext: string
  ): Promise<string> {
    if (!this.hasApiKey()) {
      return this.getFallbackResponse(memoryContext);
    }

    const systemPrompt = this.buildSystemPrompt(
      npcPersona,
      memoryContext,
      worldContext
    );

    return this.enqueueRequest([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: playerMessage },
    ]);
  }

  private buildSystemPrompt(
    persona: {
      name: string;
      role: string;
      speechStyle: string;
      personality: string;
      backstory: string;
    },
    memory: MemoryContext,
    worldContext: string
  ): string {
    let prompt = `You are ${persona.name}, the ${persona.role} of Thornwick village.

PERSONALITY: ${persona.personality}
SPEECH STYLE: ${persona.speechStyle}
BACKSTORY: ${persona.backstory}

WORLD CONTEXT: ${worldContext}`;

    if (memory.relationship) {
      const rel = memory.relationship;
      prompt += `\n\nRELATIONSHIP WITH PLAYER:
- Trust: ${(rel.trust * 100).toFixed(0)}%
- Affection: ${(rel.affection * 100).toFixed(0)}%
- Familiarity: ${(rel.familiarity * 100).toFixed(0)}%`;
      if (rel.notes.length > 0) {
        prompt += `\n- Notes: ${rel.notes.slice(-3).join('; ')}`;
      }
    }

    if (memory.recentEpisodes.length > 0) {
      prompt += '\n\nRECENT MEMORIES OF THIS PERSON:';
      for (const ep of memory.recentEpisodes) {
        prompt += `\n- Day ${ep.timestamp}: ${ep.summary}`;
      }
    }

    if (memory.relevantBeliefs.length > 0) {
      prompt += '\n\nBELIEFS ABOUT THIS PERSON:';
      for (const b of memory.relevantBeliefs) {
        prompt += `\n- ${b.fact} (confidence: ${(b.confidence * 100).toFixed(0)}%)`;
      }
    }

    prompt += `\n\nRespond in character. Keep responses under 100 words. Be natural, not theatrical.`;
    return prompt;
  }

  private getFallbackResponse(context: MemoryContext): string {
    let category = 'greeting';

    if (context.relationship) {
      const rel = context.relationship;
      if (rel.familiarity > 0.5 && rel.trust > 0.6) {
        category = 'friendly';
      } else if (rel.trust < 0.3) {
        category = 'suspicious';
      } else if (rel.familiarity > 0.3) {
        category = 'default';
      }
    }

    const responses = FALLBACK_RESPONSES[category];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private enqueueRequest(
    messages: { role: string; content: string }[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ messages, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    if (this.activeRequests >= this.maxConcurrent) return;

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const request = this.queue.shift()!;
      this.activeRequests++;

      this.callAPI(request.messages)
        .then(request.resolve)
        .catch(request.reject)
        .finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
    }

    this.processing = false;
  }

  private async callAPI(
    messages: { role: string; content: string }[]
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 200,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? 'I have nothing to say.';
    } catch (error) {
      console.error('LLM API error:', error);
      return FALLBACK_RESPONSES.default[
        Math.floor(Math.random() * FALLBACK_RESPONSES.default.length)
      ];
    }
  }
}
