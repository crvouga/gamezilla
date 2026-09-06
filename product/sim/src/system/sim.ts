import type { Session } from '@pkgs/sim';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { Driver } from '@pkgs/ui-testing';
import type { Sim } from '@product/sim/fabric/create-sim';

import type { ProductExtra } from '../hosts/ports';

export type SimActor = {
  readonly id: string;
  readonly ui: Driver;
};

export type ProductRuntime = {
  launchActor: (id: string) => Promise<SimActor>;
  resetActor: (id: string) => Promise<void>;
  disposeResources: () => Promise<void>;
};

/**
 * Results of actions whose outcome is only readable as data.
 * Written by an action, read back by the matching read function.
 */
export type ProductProbes = {
  oauthTokenLength: number | null;
  snapshot: SimSystemSnapshot | null;
};

export type ProductSim = {
  readonly session: Session;
  readonly sim: Sim;
  readonly actors: Map<string, SimActor>;
  readonly probes: ProductProbes;
  runtime: ProductRuntime;
};

function unwiredError(method: string): Error {
  return new Error(`product runtime: ${method} not wired`);
}

/** Runtime extras (`sql` / `ui` / `http`) merged onto the session ports. */
export function productExtra(s: ProductSim): ProductExtra {
  return s.session.ports as unknown as ProductExtra;
}

export function createProductSim(session: Session, sim: Sim): ProductSim {
  const actors = new Map<string, SimActor>();
  const runtime: ProductRuntime = {
    launchActor: () => Promise.reject(unwiredError('launchActor')),
    resetActor: () => Promise.reject(unwiredError('resetActor')),
    disposeResources: () => Promise.reject(unwiredError('disposeResources')),
  };
  return {
    session,
    sim,
    actors,
    probes: { oauthTokenLength: null, snapshot: null },
    runtime,
  };
}
