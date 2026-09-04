import type { Session } from '@pkgs/dst';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { Driver } from '@pkgs/ui-testing';
import type { Sim } from '@sim/console/sim/create-sim';

import type { ProductExtra } from '../host/ports';

export type SimActorHandle = {
  readonly id: string;
  readonly ui: Driver;
};

export type ProductRuntime = {
  launchActor: (id: string) => Promise<SimActorHandle>;
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

export type ProductSurface = {
  readonly session: Session;
  readonly sim: Sim;
  readonly actors: Map<string, SimActorHandle>;
  readonly probes: ProductProbes;
  runtime: ProductRuntime;
};

function unwired(method: string): never {
  throw new Error(`product runtime: ${method} not wired`);
}

/** Host extras (`sql` / `ui` / `http`) merged onto the session ports. */
export function productExtra(s: ProductSurface): ProductExtra {
  return s.session.ports as unknown as ProductExtra;
}

export function createProductSurface(
  session: Session,
  sim: Sim
): ProductSurface {
  const actors = new Map<string, SimActorHandle>();
  const runtime: ProductRuntime = {
    launchActor: async () => unwired('launchActor'),
    resetActor: async () => unwired('resetActor'),
    disposeResources: async () => unwired('disposeResources'),
  };
  return {
    session,
    sim,
    actors,
    probes: { oauthTokenLength: null, snapshot: null },
    runtime,
  };
}
