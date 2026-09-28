import type { Session } from '@pkgs/harness';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console/shared/harness-system-snapshot';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { Driver } from '@pkgs/ui-testing';
import type { Harness } from '../fabric/create-harness';
import type { ProductExtra } from '../hosts/ports';

export type HarnessActor = {
  readonly id: string;
  readonly ui: Driver;
  /**
   * The actor's local database, wherever the actor runs (in-process SQLite,
   * or inside a live browser), or `null` before the app has opened one.
   */
  readonly localSql: () => SqlTx | null;
  /** Open an app link (`/space/<id>`) the way a person pastes one. */
  readonly openLink: (path: string) => Promise<void>;
  /** The app route the actor is on — what "Copy link" would hand out. */
  readonly currentPath: () => Promise<string>;
};

export type ProductRuntime = {
  launchActor: (id: string) => Promise<HarnessActor>;
  resetActor: (id: string) => Promise<void>;
  /** App killed and reopened on the same device: storage and session survive. */
  restartActor: (id: string) => Promise<void>;
  disposeResources: () => Promise<void>;
};

/**
 * Results of actions whose outcome is only readable as data.
 * Written by an action, read back by the matching read function.
 */
export type ProductProbes = {
  snapshot: HarnessSystemSnapshot | null;
};

export type ProductHarness = {
  readonly session: Session;
  readonly harness: Harness;
  readonly actors: Map<string, HarnessActor>;
  readonly probes: ProductProbes;
  runtime: ProductRuntime;
};

function unwiredError(method: string): Error {
  return new Error(`product runtime: ${method} not wired`);
}

/** Runtime extras (`sql` / `ui` / `http`) merged onto the session ports. */
export function productExtra(s: ProductHarness): ProductExtra {
  return s.session.ports as unknown as ProductExtra;
}

export function createProductHarness(
  session: Session,
  harness: Harness
): ProductHarness {
  const actors = new Map<string, HarnessActor>();
  const runtime: ProductRuntime = {
    launchActor: () => Promise.reject(unwiredError('launchActor')),
    resetActor: () => Promise.reject(unwiredError('resetActor')),
    restartActor: () => Promise.reject(unwiredError('restartActor')),
    disposeResources: () => Promise.reject(unwiredError('disposeResources')),
  };
  return {
    session,
    harness,
    actors,
    probes: { snapshot: null },
    runtime,
  };
}
