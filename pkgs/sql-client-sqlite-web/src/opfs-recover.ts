import type { Timers } from '@pkgs/clock';
import { sleepMs } from '@pkgs/sql-client-sqlite/expo-sqlite-core';
import { RESET_DB_QUERY_PARAM } from '@pkgs/sql-client-sqlite/opfs-recover-url';
import { recoverSqlOwnerInProcess } from './recover-in-process';

export { RESET_DB_QUERY_PARAM } from '@pkgs/sql-client-sqlite/opfs-recover-url';

export {
  DEFAULT_DB_HOST_SHARED_WORKER_URL,
  forceReleaseSharedWorkerOwners,
  recoverSqlOwnerInProcess,
} from './recover-in-process';

export type RunWebOpfsRecoveryOptions = {
  readonly timers: Timers;
  /** Ignored — kept for call-site compatibility. Recovery no longer navigates. */
  readonly returnTo?: string;
  /** Close local owner / SQL client before wipe (best-effort). */
  readonly closeLocal?: () => Promise<void>;
  readonly sharedWorkerUrl?: string;
};

/**
 * User-initiated local DB wipe: in-process OPFS/cache clear, then reload the
 * product Window so React remounts against an empty cache.
 * Does **not** navigate to a wipe HTML document.
 */
export async function runWebOpfsRecoveryAndReload(
  opts: RunWebOpfsRecoveryOptions
): Promise<void> {
  await recoverSqlOwnerInProcess({
    timers: opts.timers,
    ...(opts.closeLocal !== undefined ? { closeLocal: opts.closeLocal } : {}),
    ...(opts.sharedWorkerUrl !== undefined
      ? { sharedWorkerUrl: opts.sharedWorkerUrl }
      : {}),
    notifyPeers: true,
  });
  if (typeof window === 'undefined') {
    return;
  }
  window.location.reload();
  await new Promise<void>(() => {});
}

/**
 * Legacy `?reset-db=1` escape hatch: strip the param, wipe in-process, reload.
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
  url.searchParams.delete(RESET_DB_QUERY_PARAM);
  const cleaned =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') +
    url.hash;
  try {
    window.history.replaceState(null, '', cleaned || '/');
  } catch {
    // ignore
  }
  const label = logLabel ?? 'web-opfs';
  console.warn(
    `[${label}] ?${RESET_DB_QUERY_PARAM}=1 — in-process wipe + reload.`
  );
  await runWebOpfsRecoveryAndReload({
    timers,
    ...(closeLocal !== undefined ? { closeLocal } : {}),
  });
  await sleepMs(timers, 0);
}
