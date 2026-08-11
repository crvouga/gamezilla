import type { Timers } from '@pkgs/clock';
import type { ClearExpoSqliteWebOpfsResult } from '../clear-expo-sqlite-web-opfs';
import { sleepMs, WEB_OPFS_RECOVERY_RELOAD_KEY } from '../expo-sqlite-core';
import {
  buildWebOpfsWipePageUrl,
  OPFS_WIPE_INITIATOR_SESSION_KEY,
  RESET_DB_QUERY_PARAM,
  sanitizeWebOpfsReturnTo,
} from './opfs-recover-url';
import { OPFS_WIPE_CHANNEL, type OpfsWipeMessage } from './opfs-wipe-channel';
import { createRpcIdFactory } from './rpc';

async function defaultWipeOpfs(): Promise<ClearExpoSqliteWebOpfsResult> {
  // Dynamic import keeps unit tests free of react-native (Platform).
  const { clearExpoSqliteWebOpfsBestEffort } = await import(
    '../clear-expo-sqlite-web-opfs'
  );
  return clearExpoSqliteWebOpfsBestEffort();
}

export {
  buildWebOpfsWipePageUrl,
  DEFAULT_OPFS_WIPE_PAGE_URL,
  OPFS_WIPE_INITIATOR_SESSION_KEY,
  RESET_DB_QUERY_PARAM,
  sanitizeWebOpfsReturnTo,
} from './opfs-recover-url';

/** Default SharedWorker broker URL (same as createExpoWebSqlClient). */
export const DEFAULT_DB_HOST_SHARED_WORKER_URL =
  '/sql-workers/db-host-shared-worker.js';

/** Backoff between OPFS wipe attempts while peers release sync handles. */
export const OPFS_WIPE_RETRY_MS = [
  0, 500, 1000, 2000, 3000, 5000, 8000,
] as const;

const PREPARE_WIPE_WAIT_MS = 3000;
/** Must exceed broker FORCE_RELEASE_OWNER_WAIT_MS so owners can closeAsync. */
const FORCE_RELEASE_WAIT_MS = 5_000;
/** Extra settle after force-release before touching OPFS. */
const POST_RELEASE_SETTLE_MS = 500;

const nextWipeRequestId = createRpcIdFactory('wipe');

export type RunWebOpfsRecoveryOptions = {
  readonly timers: Timers;
  /** App path to open after wipe (pathname+search+hash). Defaults to reload. */
  readonly returnTo?: string;
  /** Close local owner / SQL client before wipe (best-effort). */
  readonly closeLocal?: () => Promise<void>;
  readonly sharedWorkerUrl?: string;
};

function clearWebOpfsRecoverySessionFlag(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WEB_OPFS_RECOVERY_RELOAD_KEY);
  }
}

/**
 * Ask peer tabs to disconnect SQLite / drop OPFS handles, then wait briefly
 * for `wipe-ready` acks (best-effort count).
 */
export async function prepareWipePeers(timers: Timers): Promise<number> {
  if (typeof BroadcastChannel === 'undefined') {
    return 0;
  }
  const requestId = nextWipeRequestId();
  const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
  let ready = 0;
  channel.onmessage = (event: MessageEvent<OpfsWipeMessage>) => {
    const data = event.data;
    if (
      data !== null &&
      typeof data === 'object' &&
      data.type === 'wipe-ready' &&
      data.requestId === requestId
    ) {
      ready += 1;
    }
  };
  channel.postMessage({
    type: 'prepare-wipe',
    requestId,
  } satisfies OpfsWipeMessage);
  await sleepMs(timers, PREPARE_WIPE_WAIT_MS);
  try {
    channel.close();
  } catch {
    // ignore
  }
  return ready;
}

/**
 * Tell the SharedWorker broker to force-release every DB owner slot.
 */
export async function forceReleaseSharedWorkerOwners(
  timers: Timers,
  sharedWorkerUrl: string = DEFAULT_DB_HOST_SHARED_WORKER_URL
): Promise<boolean> {
  if (typeof SharedWorker === 'undefined') {
    return false;
  }
  try {
    const worker = new SharedWorker(sharedWorkerUrl, {
      name: 'sql-db-host',
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

export type WipeOpfsFn = () => Promise<ClearExpoSqliteWebOpfsResult>;

/**
 * Wipe `expo-sqlite` OPFS with peer + SharedWorker release between retries.
 * `wipeOpfs` is injectable for unit tests.
 */
export async function wipeExpoSqliteOpfsWithRetries(
  timers: Timers,
  sharedWorkerUrl: string = DEFAULT_DB_HOST_SHARED_WORKER_URL,
  wipeOpfs: WipeOpfsFn = defaultWipeOpfs
): Promise<ClearExpoSqliteWebOpfsResult> {
  let last: ClearExpoSqliteWebOpfsResult = {
    ok: false,
    error: new Error('OPFS wipe did not run'),
  };
  for (let i = 0; i < OPFS_WIPE_RETRY_MS.length; i++) {
    const wait = OPFS_WIPE_RETRY_MS[i] ?? 0;
    if (wait > 0) {
      await sleepMs(timers, wait);
    }
    await prepareWipePeers(timers);
    await forceReleaseSharedWorkerOwners(timers, sharedWorkerUrl);
    // AccessHandlePoolVFS sync handles are released asynchronously after
    // closeAsync; wiping immediately races Chrome's dedicated worker teardown.
    await sleepMs(timers, POST_RELEASE_SETTLE_MS);
    last = await wipeOpfs();
    if (last.ok) {
      return last;
    }
  }
  return last;
}

function broadcastWipeDone(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
    channel.postMessage({ type: 'wipe-done' } satisfies OpfsWipeMessage);
    channel.close();
  } catch {
    // ignore
  }
}

function navigateAfterWipe(returnTo: string | undefined): void {
  if (typeof window === 'undefined') return;
  const safe = sanitizeWebOpfsReturnTo(returnTo);
  if (returnTo !== undefined) {
    window.location.replace(safe);
    return;
  }
  window.location.reload();
}

/**
 * Full web OPFS recovery: close local SQL (best-effort), then navigate to the
 * same-origin wipe document. That document asks peers to park, force-releases
 * SharedWorker owners, and deletes OPFS — Chrome keeps AccessHandlePoolVFS
 * sync handles until the expo-sqlite document is torn down, so in-page wipe
 * cannot succeed. Resolves only if navigation is blocked (rare).
 */
export async function runWebOpfsRecoveryAndReload(
  opts: RunWebOpfsRecoveryOptions
): Promise<void> {
  const { returnTo, closeLocal } = opts;

  // Keep WEB_OPFS_RECOVERY_RELOAD_KEY set (owner-runtime sets it) so a failed
  // post-wipe open does not loop wipe↔boot forever. Clear only on explicit
  // user reset-db / boot CTA via clear below when absent.
  try {
    sessionStorage.removeItem('main-sqlite-tab-id');
    sessionStorage.setItem(OPFS_WIPE_INITIATOR_SESSION_KEY, '1');
    if (sessionStorage.getItem(WEB_OPFS_RECOVERY_RELOAD_KEY) !== '1') {
      sessionStorage.setItem(WEB_OPFS_RECOVERY_RELOAD_KEY, '1');
    }
  } catch {
    // ignore
  }

  if (closeLocal !== undefined) {
    // Never block wipe navigation on a hung expo-sqlite Dedicated Worker —
    // closeAsync can queue forever behind a stuck open.
    const CLOSE_LOCAL_BUDGET_MS = 1_500;
    try {
      await Promise.race([
        closeLocal(),
        sleepMs(opts.timers, CLOSE_LOCAL_BUDGET_MS),
      ]);
    } catch {
      // best-effort
    }
  }

  if (
    typeof navigator === 'undefined' ||
    navigator.storage?.getDirectory === undefined
  ) {
    broadcastWipeDone();
    navigateAfterWipe(returnTo);
    return;
  }

  // Prepare / force-release / wipe run on the clean document so we do not
  // block the React boot path (which may still be waiting on auth).
  const wipeUrl = buildWebOpfsWipePageUrl(
    returnTo !== undefined ? { returnTo } : {}
  );

  if (typeof window === 'undefined') {
    return;
  }
  window.location.replace(wipeUrl);
  await new Promise<void>(() => {});
}

/**
 * If `?reset-db=1` is present, strip it, run OPFS recovery, and navigate away.
 * Returns only when the param is absent. Never returns after starting recovery
 * unless navigation is blocked (then throws).
 */
export async function consumeResetDbQueryParamAndRecover(
  timers: Timers,
  logLabel?: string,
  closeLocal?: () => Promise<void>
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_DB_QUERY_PARAM) !== '1') {
    return;
  }
  // User-initiated escape hatch — allow another wipe even after auto-recovery.
  clearWebOpfsRecoverySessionFlag();
  url.searchParams.delete(RESET_DB_QUERY_PARAM);
  const returnTo =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
    url.hash;
  const cleaned = returnTo || '/';
  try {
    window.history.replaceState(null, '', cleaned);
  } catch {
    // ignore
  }
  const label = logLabel ?? 'web-opfs';
  console.warn(
    `[${label}] ?${RESET_DB_QUERY_PARAM}=1 detected — running web OPFS recovery.`
  );
  await runWebOpfsRecoveryAndReload({
    timers,
    returnTo: cleaned,
    ...(closeLocal !== undefined ? { closeLocal } : {}),
  });
  await new Promise<void>(() => {});
}
