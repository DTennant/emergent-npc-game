export interface QuestGate {
  npcId: string;
  questId: string;
  description: string;
  trustMin: number;
  familiarityMin: number;
  requiresItems?: { itemId: string; quantity: number }[];
}

export const QUEST_GATES: QuestGate[] = [
  {
    npcId: 'blacksmith_erik',
    questId: 'erik_forge_tools',
    description: 'Erik forges extraction tools for dungeon Runestones',
    trustMin: 0.6,
    familiarityMin: 0.4,
    requiresItems: [{ itemId: 'raw_iron', quantity: 3 }],
  },
  {
    npcId: 'herbalist_willow',
    questId: 'willow_brew_potion',
    description: 'Willow brews protection potion for Blight resistance',
    trustMin: 0.5,
    familiarityMin: 0.3,
    requiresItems: [{ itemId: 'moonpetal', quantity: 2 }],
  },
  {
    npcId: 'innkeeper_rose',
    questId: 'rose_decipher_journal',
    description: 'Rose deciphers Aldric journal pages',
    trustMin: 0.5,
    familiarityMin: 0.5,
  },
  {
    npcId: 'guard_marcus',
    questId: 'marcus_escort',
    description: 'Marcus provides tactical intel and escort to dungeons',
    trustMin: 0.7,
    familiarityMin: 0.4,
  },
  {
    npcId: 'farmer_thomas',
    questId: 'thomas_provisions',
    description: 'Thomas supplies health potions for dungeon runs',
    trustMin: 0.4,
    familiarityMin: 0.3,
  },
  {
    npcId: 'merchant_anna',
    questId: 'anna_materials',
    description: 'Anna sources rare materials for quest items',
    trustMin: 0.5,
    familiarityMin: 0.3,
    requiresItems: [{ itemId: 'gold', quantity: 50 }],
  },
];

export interface QuestGateStatus {
  canHelp: boolean;
  trustNeeded: number;
  familiarityNeeded: number;
  trustGap: number;
  familiarityGap: number;
}

export class QuestGateChecker {
  static canNPCHelp(
    npcId: string,
    questId: string,
    trust: number,
    familiarity: number
  ): boolean {
    const gate = QUEST_GATES.find(
      (g) => g.npcId === npcId && g.questId === questId
    );
    if (!gate) return false;
    return trust >= gate.trustMin && familiarity >= gate.familiarityMin;
  }

  static getGatesForNPC(npcId: string): QuestGate[] {
    return QUEST_GATES.filter((g) => g.npcId === npcId);
  }

  static getGateStatus(
    npcId: string,
    questId: string,
    trust: number,
    familiarity: number
  ): QuestGateStatus {
    const gate = QUEST_GATES.find(
      (g) => g.npcId === npcId && g.questId === questId
    );
    if (!gate) {
      return {
        canHelp: false,
        trustNeeded: 0,
        familiarityNeeded: 0,
        trustGap: 0,
        familiarityGap: 0,
      };
    }

    const trustGap = Math.max(0, gate.trustMin - trust);
    const familiarityGap = Math.max(0, gate.familiarityMin - familiarity);

    return {
      canHelp: trustGap === 0 && familiarityGap === 0,
      trustNeeded: gate.trustMin,
      familiarityNeeded: gate.familiarityMin,
      trustGap,
      familiarityGap,
    };
  }
}
