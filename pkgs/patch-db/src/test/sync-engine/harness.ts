import { afterEach, beforeEach } from 'bun:test';
import { type Sim, PatchDbScenarioBuilder } from '../../sim/scenario';

let sim: Sim;

export function getSim(): Sim {
  return sim;
}

/** After `getSim().destroy()`, set the new scenario so `afterEach` tears down the right instance. */
export function replaceSim(next: Sim): void {
  sim = next;
}

export function registerSyncEngineHooks(): void {
  beforeEach(async () => {
    sim = await new PatchDbScenarioBuilder()
      .meta({
        source: { suite: 'sync-engine (single client)' },
      })
      .server('s1')
      .client('c1', { server: 's1' })
      .build();
  });

  afterEach(async () => {
    await sim.destroy();
  });
}
