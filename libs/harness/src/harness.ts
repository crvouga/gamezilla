import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared/system-snapshot';
import type { Session } from '@pkgs/harness-root-shared/runtime-types';
import type { AudioPlayerStatus } from '@pkgs/sounds-shared/ports';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { ExecuteSqlStatements } from '@pkgs/sql-client-root-shared/statements';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import type { ActorCheckpointPort } from './client-checkpoint';
import type { Harness } from './create-harness';
import type { ProductExtra } from './ports';

export type HarnessDevice = {
  readonly audioState: () => Promise<
    readonly { source: unknown; status: AudioPlayerStatus }[]
  >;
  readonly audioFailures: () => Promise<number>;
  readonly failAudio: () => Promise<void>;
  readonly setReducedMotion: (reduced: boolean) => Promise<void>;
};

export type HarnessActor = {
  readonly checkpoint?: ActorCheckpointPort;
  readonly device: HarnessDevice;
  readonly id: string;
  readonly ui: Driver;
  /**
   * The actor's local database, wherever the actor runs (in-process SQLite,
   * or inside a live browser), or `null` before the app has opened one.
   */
  readonly localSql: () => SqlTx | null;
  readonly executeStatements: ExecuteSqlStatements;
  /** Private session probe for server-verdict reads; never recorded in reports. */
  readonly sessionToken: () => Promise<string | null>;
  readonly deviceId: () => Promise<string | null>;
  /** Open an app link (`/space/<id>`) the way a person pastes one. */
  readonly openLink: (path: string) => Promise<void>;
  /** The app route the actor is on — what "Copy link" would hand out. */
  readonly currentPath: () => Promise<string>;
  /** Change the injected viewport without restarting the app. */
  readonly setViewport: (size: {
    width: number;
    height: number;
  }) => Promise<void>;
};

export type ProductRuntime = {
  launchActor: (id: string) => Promise<HarnessActor>;
  resetActor: (id: string) => Promise<void>;
  /** App killed and reopened on the same device: storage and session survive. */
  restartActor: (id: string) => Promise<void>;
  /**
   * What the app kept on the device becomes unusable from its next opening.
   * A browser device has its real stored files damaged while the app is closed.
   */
  damageDeviceData: (id: string) => Promise<void>;
  disposeResources: () => Promise<void>;
};

/**
 * Results of actions whose outcome is only readable as data.
 * Written by an action, read back by the matching read function.
 */
export type ProductProbes = {
  snapshot: HarnessSystemSnapshot | null;
  investigationTrail?: unknown;
  recoveryAccountId?: string | null;
  environmentRelease?: {
    readonly releaseState: string;
    readonly checkState: string;
    readonly openState: string;
  };
  releaseFact?: 'passed' | 'failed' | 'unfinished' | 'release-check';
  tools?: unknown;
  deletedDeviceReply?: { status: number; body: unknown };
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
    damageDeviceData: () => Promise.reject(unwiredError('damageDeviceData')),
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
