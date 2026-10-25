import type { SimulationInterpolation } from '@pkgs/turn-game-shared-ts/simulation';
import { simulationInteger } from '@pkgs/turn-game-shared-ts/simulation';

export type InterpolationFrame<S> = {
  readonly tick: number;
  readonly state: S;
};

/**
 * Renderer-independent, bounded presentation history. Sample at the authority's
 * estimated tick minus a jitter buffer. No extrapolation changes scores or
 * physics when a packet is late; presentation holds the last received state.
 */
export class SnapshotInterpolation<S> {
  private frames: InterpolationFrame<S>[] = [];

  constructor(
    private readonly interpolate: SimulationInterpolation<S>,
    private readonly capacity: number
  ) {
    if (!simulationInteger(capacity, 2))
      throw new Error('interpolation capacity must be at least two');
  }

  push(frame: InterpolationFrame<S>): boolean {
    if (!simulationInteger(frame.tick, 0))
      throw new Error('invalid interpolation tick');
    const latest = this.frames.at(-1);
    if (latest !== undefined && frame.tick <= latest.tick) return false;
    this.frames.push(frame);
    if (this.frames.length > this.capacity) this.frames.shift();
    return true;
  }

  sample(tick: number): S | null {
    if (!Number.isFinite(tick)) throw new Error('invalid presentation tick');
    const first = this.frames[0];
    if (first === undefined) return null;
    if (tick <= first.tick) return first.state;
    for (let index = 1; index < this.frames.length; index++) {
      const before = this.frames[index - 1]!;
      const after = this.frames[index]!;
      if (tick <= after.tick)
        return this.interpolate(
          before.state,
          after.state,
          (tick - before.tick) / (after.tick - before.tick)
        );
    }
    return this.frames.at(-1)!.state;
  }

  reset(): void {
    this.frames = [];
  }
}
