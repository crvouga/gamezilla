import type { Timers } from '@pkgs/clock';
import { sleepMs, WEB_OPFS_SOFT_RECOVERY_KEY } from '../expo-sqlite-core';
import {
  buildWebOpfsWipePageUrl,
  OPFS_WIPE_INITIATOR_SESSION_KEY,
  RESET_DB_QUERY_PARAM,
} from './opfs-recover-url';

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

/** Must exceed broker FORCE_RELEASE_OWNER_WAIT_MS so owners can closeAsync. */
const FORCE_RELEASE_WAIT_MS = 5_000;

export type RunWebOpfsRecoveryOptions = {
  readonly timers: Timers;
  /** App path to open after wipe (pathname+search+hash). Defaults to `/`. */
  readonly returnTo?: string;
  /** Close local owner / SQL client before wipe (best-effort). */
  readonly closeLocal?: () => Promise<void>;
  readonly sharedWorkerUrl?: string;
};

function clearWebOpfsSoftRecoverySessionFlag(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(WEB_OPFS_SOFT_RECOVERY_KEY);
  }
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

/**
 * Explicit web OPFS wipe: close local SQL (best-effort), then navigate to the
 * same-origin wipe document. That document asks peers to park, force-releases
 * SharedWorker owners, and deletes OPFS. Never used for automatic open recovery.
 * Resolves only if navigation is blocked (rare).
 */
export async function runWebOpfsRecoveryAndReload(
  opts: RunWebOpfsRecoveryOptions
): Promise<void> {
  const { returnTo, closeLocal } = opts;

  try {
    sessionStorage.removeItem('main-sqlite-tab-id');
    sessionStorage.setItem(OPFS_WIPE_INITIATOR_SESSION_KEY, '1');
    clearWebOpfsSoftRecoverySessionFlag();
  } catch {
    // ignore
  }

  if (closeLocal !== undefined) {
    // Never block wipe navigation on a hung expo-sqlite Dedicated Worker.
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

  if (typeof window === 'undefined') {
    return;
  }

  const wipeUrl = buildWebOpfsWipePageUrl(
    returnTo !== undefined ? { returnTo } : {}
  );
  window.location.replace(wipeUrl);
  await new Promise<void>(() => {});
}

/**
 * If `?reset-db=1` is present, strip it, run OPFS wipe navigation, and leave.
 * Returns only when the param is absent.
 */
export async function consumeResetDbQueryParamAndRecover(
  timers: Timers,
  logLabel?: string,
  closeLocal?: () => Promise<void>
): Promise<void> {
  if (typeof window === 'undefined' || window.location?.href == null) {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get(RESET_DB_QUERY_PARAM) !== '1') {
    return;
  }
  clearWebOpfsSoftRecoverySessionFlag();
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
    `[${label}] ?${RESET_DB_QUERY_PARAM}=1 detected — running web OPFS wipe.`
  );
  await runWebOpfsRecoveryAndReload({
    timers,
    returnTo: cleaned,
    ...(closeLocal !== undefined ? { closeLocal } : {}),
  });
  await new Promise<void>(() => {});
}
