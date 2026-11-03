import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import type {
  AccountDeviceRow,
  AccountDeviceView,
} from './account-device-view';
import { accountDeviceViewOf } from './account-device-view';
import { useMyDeviceId } from './use-current-user';
import { useDeviceSessionFacts } from './use-device-session-facts';

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function lastSeenMsOf(row: AccountDeviceRow): number {
  const raw = readString(row.last_seen_at) ?? readString(row.created_at);
  if (raw === null) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

/** One row per device; this install's own row wins over the account's copy. */
function mergeRows(args: {
  accountId: string | null;
  remoteDevices: readonly AccountDeviceRow[];
  localDevices: readonly AccountDeviceRow[];
}): Map<string, AccountDeviceRow> {
  const byId = new Map<string, AccountDeviceRow>();
  if (args.accountId !== null) {
    for (const row of args.remoteDevices) byId.set(row.id, row);
  }
  for (const row of args.localDevices) byId.set(row.id, row);
  return byId;
}

function sortRows(
  rows: readonly AccountDeviceRow[],
  currentDeviceId: string
): AccountDeviceRow[] {
  return [...rows].sort((a, b) => {
    if (a.id === currentDeviceId && b.id !== currentDeviceId) return -1;
    if (b.id === currentDeviceId && a.id !== currentDeviceId) return 1;
    return lastSeenMsOf(b) - lastSeenMsOf(a);
  });
}

export type AccountDevices = {
  /** The listed devices, current device first. */
  readonly devices: Accessor<readonly AccountDeviceView[]>;
  /** True until the local copy may paint and both reads have hydrated. */
  readonly isLoading: Accessor<boolean>;
};

/**
 * Devices for the given account, plus the current install row when signed
 * in. Sorted with the current device first, then by `last_seen_at`
 * descending (falling back to `created_at`).
 */
export function useAccountDevices(
  accountId: Accessor<string | null>
): AccountDevices {
  const { paintReady } = useSyncEngine();
  const currentDeviceId = useMyDeviceId();
  const facts = useDeviceSessionFacts();
  const scopedAccountId = createMemo(() => (paintReady() ? accountId() : null));
  const scopedDeviceId = createMemo(() =>
    paintReady() ? currentDeviceId() : ''
  );

  const localRows = createQuery(
    () => sql<AccountDeviceRow>`
    SELECT id, created_at, platform, os_name, os_version, device_model_name,
      device_brand, device_name, app_version, app_build_number, user_agent,
      first_seen_at, last_seen_at
    FROM auth_devices
    WHERE id = ${scopedDeviceId()} AND deleted_at IS NULL
  `
  );

  // A device that left the account (signed out, or into another account)
  // keeps its old owner in this copy of `auth_devices`: its tombstoned
  // `auth_account_devices` row is what takes it off the list.
  const remoteRows = createQuery(
    () => sql<AccountDeviceRow>`
    SELECT d.id, d.created_at, d.platform, d.os_name, d.os_version,
      d.device_model_name, d.device_brand, d.device_name, d.app_version,
      d.app_build_number, d.user_agent, d.first_seen_at, d.last_seen_at
    FROM auth_devices d
    LEFT JOIN auth_account_devices m
      ON m.device_id = d.id AND m.user_id = d.user_id
    WHERE d.user_id = ${scopedAccountId()}
      AND d.deleted_at IS NULL
      AND (m.id IS NULL OR m.deleted_at IS NULL)
    LIMIT 500
  `
  );

  const devices = createMemo(() => {
    if (!paintReady()) return [];
    const merged = mergeRows({
      accountId: accountId(),
      remoteDevices: remoteRows.rows(),
      localDevices: localRows.rows(),
    });
    return sortRows([...merged.values()], currentDeviceId()).map((row) =>
      accountDeviceViewOf(row, facts())
    );
  });
  const isLoading = createMemo(
    () => !paintReady() || localRows.isLoading() || remoteRows.isLoading()
  );
  return { devices, isLoading };
}
