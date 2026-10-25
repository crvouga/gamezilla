import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { ContinuousAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { Random } from '@pkgs/uuid-shared-ts/create-id';

/** Owns decision cadence, never simulation time or authoritative input sequences. */
export class ContinuousInputPlayer {
  private currentGame: string | null = null;
  private startedAt = 0;
  private nextAt = 0;
  private interval: number | null = null;
  constructor(
    private readonly driver: Driver,
    private readonly ports: { clock: Clock; random: Random }
  ) {}
  intervalMs(): number | null {
    return this.interval;
  }
  suspend(): void {
    this.interval = null;
    this.currentGame = null;
  }
  async update(
    automation: ContinuousAutomation<Driver> | undefined,
    enabled: boolean
  ): Promise<void> {
    if (automation === undefined || !enabled) {
      this.suspend();
      return;
    }
    const game = this.driver.get('multiplayer-game');
    const shown = await game.attribute('data-shown-position');
    const gameId = await game.attribute('data-game-id');
    if (shown === null || gameId === null)
      throw new Error('The continuous game presentation is unavailable');
    await this.play(automation, gameId, shown);
  }
  private async play(
    automation: ContinuousAutomation<Driver>,
    gameId: string,
    position: string
  ): Promise<void> {
    const side = await this.side();
    if (side === null) {
      this.suspend();
      return;
    }
    const now = this.ports.clock.now();
    if (this.currentGame !== gameId) {
      this.currentGame = gameId;
      this.startedAt = now;
      this.nextAt = now;
    }
    this.interval = automation.intervalMs;
    if (now < this.nextAt) return;
    // A delayed worker samples the present once, without a burst of obsolete controls.
    this.nextAt = now + automation.intervalMs;
    const suggested = automation.choose(position, side, {
      elapsedMs: now - this.startedAt,
      random: this.ports.random,
    });
    if (suggested === null) return;
    const input = automation.parseInput(suggested);
    if (input === null)
      throw new Error(
        'The automated participant suggested an invalid continuous input'
      );
    await automation.perform(this.driver, 'multiplayer-board', side, input);
  }
  private async side(): Promise<GameSide | null> {
    for (const name of ['multiplayer-seat-near', 'multiplayer-seat-far']) {
      const seat = this.driver.get(name);
      if (!(await seat.get('multiplayer-colour').isVisible())) continue;
      const side = await seat.attribute('data-side');
      if (side === 'white' || side === 'black') return side;
    }
    return null;
  }
}
