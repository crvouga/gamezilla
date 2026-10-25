import type { SimulationInput } from '@pkgs/turn-game-shared-ts/simulation';

type InputIdentity = Pick<
  SimulationInput<unknown>,
  'playerId' | 'sequence' | 'tick'
>;

/** Bounded authority-clock receipt times; only exact applied inputs produce a sample. */
export class SimulationInputProcessing {
  private readonly pending = new Map<string, { tick: number; at: number }>();

  constructor(private readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new Error('invalid simulation input processing capacity');
  }

  record(input: InputIdentity, at: number): boolean {
    const key = this.key(input);
    if (
      !Number.isFinite(at) ||
      this.pending.has(key) ||
      this.pending.size >= this.capacity
    )
      return false;
    this.pending.set(key, { tick: input.tick, at });
    return true;
  }

  applied(
    tick: number,
    inputs: readonly InputIdentity[],
    at: number
  ): number[] {
    const samples: number[] = [];
    for (const input of inputs) {
      const key = this.key(input);
      const received = this.pending.get(key);
      this.pending.delete(key);
      if (
        received === undefined ||
        received.tick !== tick ||
        input.tick !== tick
      )
        continue;
      const elapsed = at - received.at;
      if (Number.isFinite(elapsed) && elapsed >= 0) samples.push(elapsed);
    }
    // A newer sequence can supersede an earlier input scheduled for a later tick.
    for (const [key, received] of this.pending)
      if (received.tick <= tick) this.pending.delete(key);
    return samples;
  }

  clear(): void {
    this.pending.clear();
  }

  private key(input: InputIdentity): string {
    return JSON.stringify([input.playerId, input.sequence]);
  }
}
