import { afterEach, beforeEach } from 'bun:test';
import { patchDbScenario, type Sim } from '../sim/scenario';

let sim: Sim;

export function getTwoClientSim(): Sim {
  return sim;
}

export function registerTwoClientSimHooks(): void {
  beforeEach(async () => {
    sim = await patchDbScenario()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();
  });

  afterEach(async () => {
    await sim.destroy();
  });
}
