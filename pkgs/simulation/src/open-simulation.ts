import { createSimIo, type SimClock, type SimIo } from '@pkgs/io';

import { createSimActor, type SimActor } from './actor';
import type { SimulationOptions } from './options';
import { createSeededRng } from './rng';
import type { SimulationSystemHandle, SimulationUiKind } from './system-port';

export type Simulation = {
  readonly seed: bigint;
  readonly io: SimIo;
  readonly clock: SimClock;
  readonly ui: SimulationUiKind;
  /** Create (or return cached) actor session with a live UI driver. */
  actor(id: string): Promise<SimActor>;
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
};

/**
 * Open a multi-actor UI simulation.
 *
 * Tests assert only through each actor's {@link SimActor.ui} driver.
 * The injected {@link SimulationOptions.system} owns the full stack.
 */
export async function openSimulation(
  options: SimulationOptions
): Promise<Simulation> {
  const ui: SimulationUiKind = options.ui ?? 'in-process';
  const io = createSimIo({
    seed: options.seed,
    startMs: options.startMs ?? 0,
  });
  const rng = createSeededRng(options.seed);

  const handle: SimulationSystemHandle = await options.system.start({
    io,
    rng,
    ui,
  });

  const actors = new Map<string, SimActor>();
  let disposed = false;

  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    const list = [...actors.values()].reverse();
    actors.clear();
    for (const a of list) {
      await a.dispose();
    }
    await handle.dispose();
  };

  return {
    seed: io.seed,
    io,
    clock: io.clock,
    ui,
    async actor(id: string): Promise<SimActor> {
      if (disposed) {
        throw new Error('Simulation.actor: already disposed');
      }
      const existing = actors.get(id);
      if (existing) return existing;

      const session = await handle.createSession(id);
      const created = await createSimActor({ id, session, uiKind: ui, io });
      actors.set(id, created);
      return created;
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
