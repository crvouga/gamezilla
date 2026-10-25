import type {
  SimulationInput,
  SimulationInputResult,
  SimulationOptions,
} from '@pkgs/turn-game-shared-ts/simulation';
import { simulationInteger } from '@pkgs/turn-game-shared-ts/simulation';

/** ASCII ordering avoids locale-dependent simultaneous-input resolution. */
function compareInputs<I>(
  a: SimulationInput<I>,
  b: SimulationInput<I>
): number {
  if (a.playerId !== b.playerId) return a.playerId < b.playerId ? -1 : 1;
  return a.sequence - b.sequence;
}

/** Bounded, tick-addressed mailbox. Ownership and value validation belong to the authority. */
export class SimulationInputs<I> {
  private pending: SimulationInput<I>[] = [];
  private readonly acknowledged = new Map<string, number>();

  constructor(private readonly options: SimulationOptions) {}

  add(input: SimulationInput<I>, committedTick: number): SimulationInputResult {
    if (
      input.playerId.length === 0 ||
      !simulationInteger(input.sequence, 1) ||
      !simulationInteger(input.tick, 1)
    )
      return { accepted: false, reason: 'invalid' };
    if (input.tick <= committedTick) return { accepted: false, reason: 'late' };
    if (input.tick - committedTick > this.options.maxInputLeadTicks)
      return { accepted: false, reason: 'future' };
    if (
      input.sequence <= (this.acknowledged.get(input.playerId) ?? 0) ||
      this.pending.some(
        (item) =>
          item.playerId === input.playerId && item.sequence === input.sequence
      )
    )
      return { accepted: false, reason: 'duplicate' };
    if (this.pending.length >= this.options.maxQueuedInputs)
      return { accepted: false, reason: 'full' };
    this.pending.push(structuredClone(input));
    return { accepted: true };
  }

  at(tick: number): readonly SimulationInput<I>[] {
    const inputs = this.pending
      .filter((input) => input.tick === tick)
      .sort(compareInputs);
    return inputs.filter(
      (input) => input.sequence > (this.acknowledged.get(input.playerId) ?? 0)
    );
  }

  commit(tick: number, inputs: readonly SimulationInput<I>[]): void {
    this.pending = this.pending.filter((input) => input.tick > tick);
    for (const input of inputs)
      this.acknowledged.set(input.playerId, input.sequence);
  }

  acknowledgments(): Readonly<Record<string, number>> {
    return Object.fromEntries(
      [...this.acknowledged].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    );
  }

  reset(acknowledged: Readonly<Record<string, number>>): void {
    const entries = Object.entries(acknowledged);
    for (const [player, sequence] of entries)
      if (player.length === 0 || !simulationInteger(sequence, 0))
        throw new Error('invalid simulation acknowledgment');
    this.pending = [];
    this.acknowledged.clear();
    for (const [player, sequence] of entries) {
      this.acknowledged.set(player, sequence);
    }
  }
}
