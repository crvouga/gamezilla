import type { Session } from '@pkgs/dst';
import type { Driver } from '@pkgs/ui-testing';
import type { Sim } from '@sim/console/sim/create-sim';

export type SimActorHandle = {
  readonly id: string;
  readonly ui: Driver;
};

export type ProductRuntime = {
  launchActor: (id: string) => Promise<SimActorHandle>;
  resetActor: (id: string) => Promise<void>;
  clearUiFocus: () => void;
  disposeResources: () => Promise<void>;
};

export type ProductSurface = {
  readonly session: Session;
  readonly sim: Sim;
  readonly actors: Map<string, SimActorHandle>;
  runtime: ProductRuntime;
};

function unwired(method: string): never {
  throw new Error(`product runtime: ${method} not wired`);
}

export function createProductSurface(
  session: Session,
  sim: Sim
): ProductSurface {
  const actors = new Map<string, SimActorHandle>();
  const runtime: ProductRuntime = {
    launchActor: async () => unwired('launchActor'),
    resetActor: async () => unwired('resetActor'),
    clearUiFocus: () => unwired('clearUiFocus'),
    disposeResources: async () => unwired('disposeResources'),
  };
  return { session, sim, actors, runtime };
}
