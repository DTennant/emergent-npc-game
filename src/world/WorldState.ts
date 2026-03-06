import { BlightSystemJSON } from './BlightSystem';
import { EventBus, Events } from './EventBus';
import { VillageMemory, VillageMemoryJSON } from './VillageMemory';
import { StorylineManagerJSON } from '../story/StorylineManager';
import { DAY_LENGTH_MS } from '../config';

export interface VillageState {
  name: string;
  population: number;
  prosperity: number; // 0-1
  safety: number; // 0-1
  blightIntensity: number; // 0-1
  resources: Record<string, number>;
}

export interface WorldStateJSON {
  day: number;
  gameTime: number;
  elapsedMs: number;
  paused: boolean;
  village: VillageState;
  worldFacts: string[];
  villageMemory?: VillageMemoryJSON;
  blightSystem?: BlightSystemJSON;
  storyline?: StorylineManagerJSON;
}

export class WorldState {
  private gameTime = 0; // in-game minutes since cycle start
  private day = 1;
  private elapsedMs = 0;
  private paused = false;
  private prevHour = 6;

  public village: VillageState = {
    name: 'Thornwick',
    population: 6,
    prosperity: 0.6,
    safety: 0.8,
    blightIntensity: 0,
    resources: {
      food: 100,
      iron: 50,
      herbs: 30,
      gold: 200,
      wood: 80,
    },
  };

  public blightSystemData: BlightSystemJSON | undefined;
  public storylineData: StorylineManagerJSON | undefined;

  public villageMemory = new VillageMemory();

  public worldFacts: string[] = [
    'Thornwick is a small village surrounded by forest',
    'The northern mines have been producing less iron lately',
    'Wolves have been spotted near the eastern road',
    'The harvest festival is approaching',
  ];

  update(delta: number): void {
    if (this.paused) return;

    this.elapsedMs += delta;

    const newGameTime = Math.floor(((this.elapsedMs % DAY_LENGTH_MS) / DAY_LENGTH_MS) * 24 * 60);
    this.gameTime = newGameTime;

    const currentHour = this.getHour();
    if (this.prevHour >= 23 && currentHour === 0) {
      this.day++;
      EventBus.emit(Events.DAY_CHANGE, { day: this.day });
    }
    this.prevHour = currentHour;

    EventBus.emit(Events.TIME_TICK, {
      gameTime: this.gameTime,
      day: this.day,
      hour: currentHour,
      minute: this.getMinute(),
      timeString: this.getTimeString(),
    });
  }

  getHour(): number {
    return Math.floor(((this.gameTime / (24 * 60)) * 24 + 6) % 24);
  }

  getMinute(): number {
    return this.gameTime % 60;
  }

  getTimeString(): string {
    const h = this.getHour().toString().padStart(2, '0');
    const m = this.getMinute().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  getDay(): number {
    return this.day;
  }

  getDayTimeLabel(): string {
    const hour = this.getHour();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  toJSON(): WorldStateJSON {
    return {
      day: this.day,
      gameTime: this.gameTime,
      elapsedMs: this.elapsedMs,
      paused: this.paused,
      village: {
        ...this.village,
        resources: { ...this.village.resources },
      },
      worldFacts: [...this.worldFacts],
      villageMemory: this.villageMemory.toJSON(),
      blightSystem: this.blightSystemData,
      storyline: this.storylineData,
    };
  }

  fromJSON(data: WorldStateJSON): void {
    this.day = data.day;
    this.gameTime = data.gameTime;
    this.elapsedMs = data.elapsedMs;
    this.paused = data.paused;
    this.prevHour = this.getHour();
    this.village = {
      ...data.village,
      resources: { ...data.village.resources },
    };
    this.worldFacts = [...data.worldFacts];
    if (data.villageMemory) {
      this.villageMemory.fromJSON(data.villageMemory);
    }
  }
}
