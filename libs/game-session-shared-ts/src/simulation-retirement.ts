import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import type { SimulationStep } from '@pkgs/turn-game-shared-ts/simulation';

/**
 * Absent seats under the `continue` disconnection policy. Each absent seat is
 * retired from a logical tick fixed when its absence began (that tick plus
 * the grace period in ticks), so retirement depends only on ticks, never on
 * when a timer happened to wake.
 */
export class SimulationRetirement {
  private readonly from = new Map<GameSide, number>();
  private readonly graceTicks: number;
  private readonly retire: (state: unknown, side: GameSide) => unknown;

  constructor(simulation: RegisteredSimulation) {
    const disconnection = simulation.disconnection;
    if (disconnection?.policy !== 'continue')
      throw new Error('only a continuing simulation retires absent seats');
    this.retire = disconnection.retire;
    this.graceTicks = Math.ceil(
      (disconnection.graceMs * simulation.timing.tickRate) / 1000
    );
  }

  /** Seats absent after `committedTick`; returning seats are never retired again. */
  absent(sides: readonly GameSide[], committedTick: number): void {
    for (const side of [...this.from.keys()])
      if (!sides.includes(side)) this.from.delete(side);
    for (const side of sides)
      if (!this.from.has(side))
        this.from.set(side, committedTick + 1 + this.graceTicks);
  }

  /** Retire due seats, in seat order, before each step. */
  wrap(
    step: SimulationStep<unknown, unknown>
  ): SimulationStep<unknown, unknown> {
    return (state, inputs, context) => {
      let current = state;
      for (const [side, from] of [...this.from].sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0
      ))
        if (context.tick >= from) current = this.retire(current, side);
      return step(current, inputs, context);
    };
  }
}

export function continuesWhenAbsent(simulation: RegisteredSimulation): boolean {
  return simulation.disconnection?.policy === 'continue';
}
