import { TILE_SIZE } from '../config';

export type EnemyAIState = 'patrol' | 'chase' | 'attack' | 'dead';

export class EnemyAI {
  state: EnemyAIState = 'patrol';

  private patrolTargetX = 0;
  private patrolTargetY = 0;
  private patrolTimer = 0;
  private patrolInterval = 3000;
  private spawnX: number;
  private spawnY: number;
  private lastAttackTime = 0;

  constructor(spawnX: number, spawnY: number) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.pickPatrolTarget();
  }

  update(
    delta: number,
    distToPlayer: number,
    spriteX: number,
    spriteY: number,
    playerX: number,
    playerY: number,
    aggroRange: number,
    attackCooldown: number,
    speed: number
  ): { vx: number; vy: number } {
    if (this.state === 'dead') {
      return { vx: 0, vy: 0 };
    }

    // --- State transitions ---
    if (distToPlayer <= TILE_SIZE) {
      this.state = 'attack';
    } else if (distToPlayer <= aggroRange) {
      this.state = 'chase';
    } else {
      this.state = 'patrol';
    }

    // --- State behavior ---
    switch (this.state) {
      case 'patrol':
        return this.updatePatrol(delta, spriteX, spriteY, speed);
      case 'chase':
        return this.updateChase(spriteX, spriteY, playerX, playerY, speed);
      case 'attack':
        return { vx: 0, vy: 0 };
      default:
        return { vx: 0, vy: 0 };
    }
  }

  canAttack(now: number, attackCooldown: number): boolean {
    if (this.state !== 'attack') return false;
    if (now - this.lastAttackTime < attackCooldown) return false;
    this.lastAttackTime = now;
    return true;
  }

  die(): void {
    this.state = 'dead';
  }

  private updatePatrol(
    delta: number,
    spriteX: number,
    spriteY: number,
    speed: number
  ): { vx: number; vy: number } {
    this.patrolTimer += delta;

    if (this.patrolTimer >= this.patrolInterval) {
      this.pickPatrolTarget();
    }

    const dx = this.patrolTargetX - spriteX;
    const dy = this.patrolTargetY - spriteY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.pickPatrolTarget();
      return { vx: 0, vy: 0 };
    }

    return {
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
    };
  }

  private updateChase(
    spriteX: number,
    spriteY: number,
    playerX: number,
    playerY: number,
    speed: number
  ): { vx: number; vy: number } {
    const dx = playerX - spriteX;
    const dy = playerY - spriteY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const chaseSpeed = speed * 1.5;
    return {
      vx: (dx / dist) * chaseSpeed,
      vy: (dy / dist) * chaseSpeed,
    };
  }

  private pickPatrolTarget(): void {
    const range = TILE_SIZE * 4;
    this.patrolTargetX = this.spawnX + (Math.random() - 0.5) * range * 2;
    this.patrolTargetY = this.spawnY + (Math.random() - 0.5) * range * 2;
    this.patrolTimer = 0;
    this.patrolInterval = 3000 + Math.random() * 2000;
  }
}
