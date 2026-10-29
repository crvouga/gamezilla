import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  openWithWaitRetry,
  sleepMs,
} from '@pkgs/sql-client-sqlite-web-shared-ts/open-retry';
import {
  SQL_DB_HOST_PROTOCOL_VERSION,
  sqlDbHostSharedWorkerName,
} from '@pkgs/sql-client-sqlite-web-shared-ts/sql-db-host-protocol';
import type { SqlOwner } from '@pkgs/sql-client-sqlite-web-shared-ts/sql-owner';
import { isSqlOwnerWipeWorthyError } from '@pkgs/sql-client-sqlite-web-shared-ts/sql-owner';
import { OPFS_SAH_POOL_ROOT } from './opfs-sah-pool-backend';

export const DEFAULT_DB_HOST_SHARED_WORKER_URL =
  '/sql-workers/db-host-shared-worker.js';

/**
 * Same-origin channel so web OPFS recovery can ask live tabs to drop handles.
 * Peers listen in `web-sql-client.ts` and disconnect their owner on
 * `prepare-wipe`, which terminates the dedicated sqlite-wasm worker and frees
 * every OPFS sync access handle. A BroadcastChannel is scoped to its origin,
 * so the name needs no host prefix.
 */
export const OPFS_WIPE_CHANNEL = 'sqlite-opfs-wipe';

/** Must exceed broker FORCE_RELEASE_OWNER_WAIT_MS so owners can closeAsync. */
const FORCE_RELEASE_WAIT_MS = 5_000;

const PREPARE_WIPE_ACK_MS = 2_000;

/**
 * Tell the SharedWorker broker to force-release every DB owner slot.
 */
export async function forceReleaseSharedWorkerOwners(
  timers: Timers,
  sharedWorkerUrl: string = DEFAULT_DB_HOST_SHARED_WORKER_URL,
  protocolVersion: number = SQL_DB_HOST_PROTOCOL_VERSION
): Promise<boolean> {
  if (typeof SharedWorker === 'undefined') {
    return false;
  }
  try {
    const worker = new SharedWorker(sharedWorkerUrl, {
      name: sqlDbHostSharedWorkerName(protocolVersion),
      type: 'module',
    });
    const port = worker.port;
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        try {
          port.close();
        } catch {
          // ignore
        }
        resolve(ok);
      };
      port.onmessage = (event: MessageEvent<{ ok?: boolean; id?: string }>) => {
        const data = event.data;
        if (data?.ok === true && data.id === 'force-release-all') {
          done(true);
        }
      };
      port.start();
      port.postMessage({
        id: 'force-release-all',
        type: 'force-release-all',
      });
      timers.setTimeout(() => done(false), FORCE_RELEASE_WAIT_MS);
    });
  } catch {
    return false;
  }
}

let wipeRequestSeq = 0;

async function notifyPeersToDropHandles(timers: Timers): Promise<void> {
  if (typeof BroadcastChannel === 'undefined') return;
  wipeRequestSeq += 1;
  const requestId = `wipe_${wipeRequestSeq}`;
  const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
  try {
    channel.postMessage({ type: 'prepare-wipe', requestId });
    await sleepMs(timers, PREPARE_WIPE_ACK_MS);
  } finally {
    try {
      channel.close();
    } catch {
      // ignore
    }
  }
}

async function closeLocalBudgeted(
  timers: Timers,
  closeLocal: () => Promise<void>
): Promise<void> {
  const CLOSE_LOCAL_BUDGET_MS = 1_500;
  try {
    await Promise.race([closeLocal(), sleepMs(timers, CLOSE_LOCAL_BUDGET_MS)]);
  } catch {
    // best-effort
  }
}

type OpfsGlobals = {
  readonly navigator?: {
    readonly storage?: {
      readonly getDirectory?: () => Promise<{
        readonly removeEntry: (
          name: string,
          options?: { readonly recursive?: boolean }
        ) => Promise<void>;
      }>;
    };
  };
};

/**
 * Drop every OPFS SAH pool under `sqlite-web/`. All owners must be released
 * (peers disconnected + broker force-released) before this runs; the pool VFS
 * holds sync access handles in its worker realm.
 */
export async function wipeOpfsSahPoolStores(): Promise<void> {
  const global = globalThis as OpfsGlobals;
  const getDirectory = global.navigator?.storage?.getDirectory;
  if (typeof getDirectory !== 'function') return;
  const root = await getDirectory();
  const dirName = OPFS_SAH_POOL_ROOT.replace(/^\//, '');
  try {
    await root.removeEntry(dirName, { recursive: true });
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.name !== 'NotFoundError') {
      throw error;
    }
  }
}

export type RunWebOpfsRecoveryOptions = {
  readonly timers: Timers;
  /** Ignored — kept for call-site compatibility. Recovery ends in a reload. */
  readonly returnTo?: string;
  /** Close local owner / SQL client before wipe (best-effort). */
  readonly closeLocal?: () => Promise<void>;
  readonly sharedWorkerUrl?: string;
};

/**
 * User-initiated local DB wipe: peer tabs drop owners → broker force-releases →
 * remove every OPFS SAH pool directory → reload the product Window.
 */
export async function runWebOpfsRecoveryAndReload(
  opts: RunWebOpfsRecoveryOptions
): Promise<void> {
  await notifyPeersToDropHandles(opts.timers);
  await forceReleaseSharedWorkerOwners(
    opts.timers,
    opts.sharedWorkerUrl ?? DEFAULT_DB_HOST_SHARED_WORKER_URL,
    SQL_DB_HOST_PROTOCOL_VERSION
  );
  if (opts.closeLocal !== undefined) {
    await closeLocalBudgeted(opts.timers, opts.closeLocal);
  }
  await wipeOpfsSahPoolStores();
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    window.location.reload();
    await new Promise<void>(() => {});
  }
}

/** Recover only the owned database, without releasing its broker slot. */
export async function openSqlOwnerWithRecovery(args: {
  readonly dbName: string;
  readonly owner: SqlOwner;
  readonly timers: Timers;
  readonly logger: Logger;
  readonly migrate: (client: SqlClient) => Promise<void>;
  readonly signal?: AbortSignal;
}): Promise<SqlClient> {
  const open = () =>
    openWithWaitRetry({
      databaseName: args.dbName,
      timers: args.timers,
      logger: args.logger,
      ...(args.signal === undefined ? {} : { signal: args.signal }),
      openOnce: async () => {
        args.signal?.throwIfAborted();
        try {
          const client = await args.owner.open();
          await args.migrate(client);
          args.signal?.throwIfAborted();
          return client;
        } catch (error: unknown) {
          await args.owner.close();
          throw error;
        }
      },
    });
  try {
    return await open();
  } catch (error: unknown) {
    await args.owner.close();
    args.signal?.throwIfAborted();
    // Contention is not corruption. Never erase a database held by another owner.
    if (!isSqlOwnerWipeWorthyError(error)) throw error;
    await args.owner.resetStore();
    return open();
  }
}
