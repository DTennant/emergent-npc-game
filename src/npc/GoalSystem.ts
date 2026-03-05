import { NPCGoal } from '../memory/types';

export class GoalSystem {
  private goals: NPCGoal[] = [];

  constructor(startingGoals: string[]) {
    this.goals = startingGoals.map((description, index) => ({
      id: `goal_${index}`,
      description,
      priority: Math.max(1, 5 - index),
      status: 'active' as const,
      progress: 0,
    }));
  }

  getActiveGoals(): NPCGoal[] {
    return this.goals.filter(g => g.status === 'active');
  }

  getGoalSummary(): string {
    const active = this.getActiveGoals();
    if (active.length === 0) return '';
    const lines = active
      .sort((a, b) => b.priority - a.priority)
      .map(g => `- ${g.description} (priority ${g.priority}, ${Math.round(g.progress * 100)}% done)`);
    return `Your current goals:\n${lines.join('\n')}`;
  }

  updateGoalProgress(goalId: string, progress: number): void {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;
    goal.progress = Math.max(0, Math.min(1, progress));
    if (goal.progress >= 1.0) {
      goal.status = 'completed';
    }
  }

  blockGoal(goalId: string, reason: string): void {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return;
    goal.status = 'blocked';
    goal.blockedReason = reason;
  }

  toJSON(): NPCGoal[] {
    return this.goals.map(g => ({ ...g }));
  }

  fromJSON(data: NPCGoal[]): void {
    this.goals = data.map(g => ({ ...g }));
  }
}
