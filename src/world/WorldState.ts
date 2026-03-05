import { EventBus, Events } from './EventBus';
import { DAY_LENGTH_MS } from '../config';

export interface VillageState {
  name: string;
  population: number;
  prosperity: number; // 0-1
  safety: number; // 0-1
  resources: Record<string, number>;
}

export class WorldState {
  private gameTime = 0; // in-game minutes (0 = 6:00 AM)
  private day = 1;
  private elapsedMs = 0;
  private paused = false;

  public village: VillageState = {
    name: 'Thornwick',
    population: 6,
    prosperity: 0.6,
    safety: 0.8,
    resources: {
      food: 100,
      iron: 50,
      herbs: 30,
      gold: 200,
      wood: 80,
    },
  };

  // Track known facts about the world
  public worldFacts: string[] = [
    'Thornwick is a small village surrounded by forest',
    'The northern mines have been producing less iron lately',
    'Wolves have been spotted near the eastern road',
    'The harvest festival is approaching',
  ];

  update(delta: number): void {
    if (this.paused) return;

    this.elapsedMs += delta;

    // Convert real time to game time
    const minutesPerMs = (24 * 60) / DAY_LENGTH_MS;
    const newGameTime = Math.floor(((this.elapsedMs % DAY_LENGTH_MS) / DAY_LENGTH_MS) * 24 * 60);

    if (newGameTime < this.gameTime) {
      // Day rolled over
      this.day++;
      EventBus.emit(Events.DAY_CHANGE, { day: this.day });
    }

    this.gameTime = newGameTime;
    EventBus.emit(Events.TIME_TICK, {
      gameTime: this.gameTime,
      day: this.day,
      hour: this.getHour(),
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
}
