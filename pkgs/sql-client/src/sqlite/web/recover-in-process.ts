import type { Timers } from '@pkgs/clock';
import { clearExpoSqliteWebOpfsBestEffort } from '../clear-expo-sqlite-web-opfs';
import { sleepMs } from '../expo-sqlite-core';
import {
  SQL_DB_HOST_PROTOCOL_VERSION,
  sqlDbHostSharedWorkerName,
} from './sql-db-host-protocol';
import type { SqlOwner } from './sql-owner';
import { isSqlOwnerWipeWorthyError } from './sql-owner';

export const DEFAULT_DB_HOST_SHARED_WORKER_URL =
  '/sql-workers/db-host-shared-worker.js';

/** Must exceed broker FORCE_RELEASE_OWNER_WAIT_MS so owners can closeAsync. */
const FORCE_RELEASE_WAIT_MS = 5_000;

const PREPARE_WIPE_CHANNEL = 'gamezilla-opfs-wipe';
const PREPARE_WIPE_ACK_MS = 2_000;

export type RecoverInProcessOptions = {
  readonly timers: Timers;
  /** Close local owner / SQL client before wipe (best-effort). */
  readonly closeLocal?: () => Promise<void>;
  /** Wipe backing bytes after close (owner.resetStore / OPFS directory). */
  readonly resetStore?: () => Promise<void>;
  readonly sharedWorkerUrl?: string;
  readonly protocolVersion?: number;
  /**
   * Ask peer tabs to drop their owners (BroadcastChannel). Peers should
   * disconnect / destroy iframes — not navigate away.
   */
  readonly notifyPeers?: boolean;
};

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
  const channel = new BroadcastChannel(PREPARE_WIPE_CHANNEL);
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

/**
 * In-process recovery: peers drop handles → force-release SharedWorker →
 * close local owner (iframe teardown) → wipe store → done.
 * Never navigates. Product Window stays put.
 */
export async function recoverSqlOwnerInProcess(
  opts: RecoverInProcessOptions
): Promise<void> {
  if (opts.notifyPeers !== false) {
    await notifyPeersToDropHandles(opts.timers);
  }
  await forceReleaseSharedWorkerOwners(
    opts.timers,
    opts.sharedWorkerUrl ?? DEFAULT_DB_HOST_SHARED_WORKER_URL,
    opts.protocolVersion ?? SQL_DB_HOST_PROTOCOL_VERSION
  );
  if (opts.closeLocal !== undefined) {
    await closeLocalBudgeted(opts.timers, opts.closeLocal);
  }
  if (opts.resetStore !== undefined) {
    await opts.resetStore();
  } else {
    const wiped = await clearExpoSqliteWebOpfsBestEffort();
    if (!wiped.ok) {
      throw new Error(
        'Failed to wipe expo-sqlite OPFS directory after releasing owners',
        { cause: wiped.error }
      );
    }
  }
}

/**
 * Open via {@link SqlOwner}: on wipe-worthy failure, recover in-process once
 * and reopen. Returns a fresh empty cache when recovery ran.
 */
export async function openSqlOwnerWithRecovery(args: {
  readonly owner: SqlOwner;
  readonly timers: Timers;
  readonly sharedWorkerUrl?: string;
  readonly notifyPeers?: boolean;
  /** Optional post-open migrate; wipe-worthy failures also trigger recovery. */
  readonly migrate?: (
    client: import('../../interface').SqlClient
  ) => Promise<void>;
}): Promise<import('../../interface').SqlClient> {
  const tryOnce = async () => {
    const client = await args.owner.open();
    if (args.migrate !== undefined) {
      await args.migrate(client);
    }
    return client;
  };

  try {
    return await tryOnce();
  } catch (first: unknown) {
    if (!isSqlOwnerWipeWorthyError(first)) throw first;
    await recoverSqlOwnerInProcess({
      timers: args.timers,
      closeLocal: () => args.owner.close(),
      resetStore: () => args.owner.resetStore(),
      ...(args.sharedWorkerUrl !== undefined
        ? { sharedWorkerUrl: args.sharedWorkerUrl }
        : {}),
      ...(args.notifyPeers !== undefined
        ? { notifyPeers: args.notifyPeers }
        : {}),
    });
    try {
      return await tryOnce();
    } catch (second: unknown) {
      throw new Error(
        `SQLite could not open after in-process wipe (${
          second instanceof Error ? second.message : String(second)
        })`,
        { cause: second }
      );
    }
  }
}

export { PREPARE_WIPE_CHANNEL };
