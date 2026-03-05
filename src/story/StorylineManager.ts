import { EventBus, Events } from '../world/EventBus';

export interface DungeonStatus {
  discovered: boolean;
  npcHelped: boolean;
  dungeonCleared: boolean;
  runestoneObtained: boolean;
}

export interface StorylineManagerJSON {
  blightAwareness: boolean;
  runestoneStatus: Record<string, DungeonStatus>;
  shrineActivated: boolean;
}

export class StorylineManager {
  blightAwareness = false;
  runestoneStatus: Record<string, DungeonStatus> = {
    forest_cave: { discovered: false, npcHelped: false, dungeonCleared: false, runestoneObtained: false },
    abandoned_mine: { discovered: false, npcHelped: false, dungeonCleared: false, runestoneObtained: false },
    ruined_tower: { discovered: false, npcHelped: false, dungeonCleared: false, runestoneObtained: false },
  };
  shrineActivated = false;

  discoverBlight(): void {
    this.blightAwareness = true;
  }

  discoverDungeon(dungeonId: string): void {
    const status = this.runestoneStatus[dungeonId];
    if (status) {
      status.discovered = true;
      EventBus.emit(Events.QUEST_PROGRESS, {
        type: 'dungeon_discovered',
        dungeonId,
      });
    }
  }

  markNPCHelped(dungeonId: string): void {
    const status = this.runestoneStatus[dungeonId];
    if (status) {
      status.npcHelped = true;
      EventBus.emit(Events.QUEST_PROGRESS, {
        type: 'npc_helped',
        dungeonId,
      });
    }
  }

  clearDungeon(dungeonId: string): void {
    const status = this.runestoneStatus[dungeonId];
    if (status) {
      status.dungeonCleared = true;
      EventBus.emit(Events.QUEST_PROGRESS, {
        type: 'dungeon_cleared',
        dungeonId,
      });
    }
  }

  obtainRunestone(dungeonId: string): void {
    const status = this.runestoneStatus[dungeonId];
    if (status) {
      status.runestoneObtained = true;
      EventBus.emit(Events.RUNESTONE_OBTAINED, { dungeonId });
    }
  }

  getRunestoneCount(): number {
    return Object.values(this.runestoneStatus).filter(s => s.runestoneObtained).length;
  }

  canActivateShrine(): boolean {
    return Object.values(this.runestoneStatus).every(s => s.runestoneObtained);
  }

  activateShrine(): void {
    this.shrineActivated = true;
    EventBus.emit(Events.SHRINE_ACTIVATED, {});
  }

  getQuestContextForNPC(npcId: string, trust: number, familiarity: number): string {
    const parts: string[] = [];

    if (!this.blightAwareness) {
      return '';
    }

    const count = this.getRunestoneCount();
    if (count > 0) {
      parts.push(`The player has collected ${count} of 3 Runestones needed to seal the Blight.`);
    }

    if (this.shrineActivated) {
      parts.push('The Shrine of Dawn has been activated and the Blight is sealed.');
      return parts.join(' ');
    }

    switch (npcId) {
      case 'blacksmith_erik':
        if (trust >= 0.6) {
          parts.push('The player is seeking help with extraction tools to retrieve Runestones from dangerous dungeons.');
          if (this.runestoneStatus.abandoned_mine.discovered) {
            parts.push('The Abandoned Mine has been discovered and may need special tools to navigate.');
          }
        }
        break;

      case 'innkeeper_rose':
        if (trust >= 0.5 && familiarity >= 0.5) {
          parts.push('The player may ask about Sage Aldric\'s journal and the old legends of Thornwick.');
          if (this.runestoneStatus.forest_cave.discovered) {
            parts.push('The Forest Cave location has been discovered from the journal.');
          }
        }
        break;

      case 'herbalist_willow':
        if (trust >= 0.5) {
          parts.push('The player may need protection potions to resist the Blight\'s corruption in dungeons.');
          if (this.runestoneStatus.ruined_tower.discovered) {
            parts.push('The Ruined Tower is known to be heavily corrupted by the Blight.');
          }
        }
        break;

      case 'guard_marcus':
        if (trust >= 0.7) {
          parts.push('The player is investigating dangerous locations tied to the Blight. You could provide tactical intel and escort.');
          const discoveredDungeons = Object.entries(this.runestoneStatus)
            .filter(([, s]) => s.discovered && !s.dungeonCleared)
            .map(([id]) => id.replace('_', ' '));
          if (discoveredDungeons.length > 0) {
            parts.push(`Known uncleared threats: ${discoveredDungeons.join(', ')}.`);
          }
        }
        break;

      case 'farmer_thomas':
        if (trust >= 0.4) {
          parts.push('The player may need provisions and supplies for dangerous dungeon expeditions.');
        }
        break;

      case 'merchant_anna':
        if (trust >= 0.5) {
          parts.push('The player may seek rare materials needed for the quest to seal the Blight.');
          if (this.runestoneStatus.ruined_tower.discovered) {
            parts.push('An enchanted blade is needed for the Ruined Tower — rare materials may be required.');
          }
        }
        break;
    }

    return parts.join(' ');
  }

  getOverallQuestSummary(): string {
    const count = this.getRunestoneCount();
    const parts: string[] = [];

    if (this.shrineActivated) {
      parts.push('The Blight has been sealed! Thornwick is saved.');
      return parts.join(' ');
    }

    parts.push(`The quest to seal the Blight: ${count} of 3 Runestones found.`);

    for (const [id, status] of Object.entries(this.runestoneStatus)) {
      const name = id.replace('_', ' ');
      if (status.runestoneObtained) {
        parts.push(`${name}: Runestone obtained.`);
      } else if (status.dungeonCleared) {
        parts.push(`${name}: cleared, Runestone awaiting retrieval.`);
      } else if (status.discovered) {
        parts.push(`${name}: discovered but not yet cleared.`);
      }
    }

    if (count === 3) {
      parts.push('All Runestones collected — the Shrine of Dawn can be activated!');
    }

    return parts.join(' ');
  }

  toJSON(): StorylineManagerJSON {
    return {
      blightAwareness: this.blightAwareness,
      runestoneStatus: JSON.parse(JSON.stringify(this.runestoneStatus)),
      shrineActivated: this.shrineActivated,
    };
  }

  fromJSON(data: StorylineManagerJSON): void {
    this.blightAwareness = data.blightAwareness;
    this.shrineActivated = data.shrineActivated;
    for (const [id, status] of Object.entries(data.runestoneStatus)) {
      if (this.runestoneStatus[id]) {
        this.runestoneStatus[id] = { ...status };
      }
    }
  }
}
