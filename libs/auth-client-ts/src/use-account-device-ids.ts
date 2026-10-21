import sql from '@pkgs/sql-root-shared-ts/sql';

import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { useMyDeviceId } from './use-current-user';

type DeviceRow = {
  readonly id: string;
  readonly last_seen_at: string | null;
  readonly created_at: string | null;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function lastSeenMsOf(row: DeviceRow): number {
  const raw = readString(row.last_seen_at) ?? readString(row.created_at);
  if (raw === null) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function buildLastSeenMap(args: {
  accountId: string | null;
  remoteDevices: readonly DeviceRow[];
  localDevices: readonly DeviceRow[];
}): Map<string, number> {
  const byId = new Map<string, number>();
  if (args.accountId !== null) {
    for (const row of args.remoteDevices) byId.set(row.id, lastSeenMsOf(row));
  }
  for (const row of args.localDevices) byId.set(row.id, lastSeenMsOf(row));
  return byId;
}

function sortDeviceIds(
  byId: Map<string, number>,
  currentDeviceId: string
): string[] {
  return [...byId.keys()].sort((a, b) => {
    if (a === currentDeviceId && b !== currentDeviceId) return -1;
    if (b === currentDeviceId && a !== currentDeviceId) return 1;
    return (byId.get(b) ?? 0) - (byId.get(a) ?? 0);
  });
}

export type AccountDeviceIds = {
  /** The listed device ids, current device first. */
  readonly ids: Accessor<string[]>;
  /** True until the local copy may paint and both reads have hydrated. */
  readonly isLoading: Accessor<boolean>;
};

/**
 * Device ids for the given account, plus the current install row when
 * signed in. Sorted with the current device first, then by `last_seen_at`
 * descending (falling back to `created_at`).
 */
export function useAccountDeviceIds(
  accountId: Accessor<string | null>
): AccountDeviceIds {
  const { paintReady } = useSyncEngine();
  const currentDeviceId = useMyDeviceId();
  const scopedAccountId = createMemo(() => (paintReady() ? accountId() : null));
  const scopedDeviceId = createMemo(() =>
    paintReady() ? currentDeviceId() : ''
  );

  const localRows = createQuery(
    () => sql<DeviceRow>`
    SELECT id, last_seen_at, created_at
    FROM auth_devices
    WHERE id = ${scopedDeviceId()} AND deleted_at IS NULL
  `
  );

  // A device that left the account (signed out, or into another account)
  // keeps its old owner in this copy of `auth_devices`: its tombstoned
  // `auth_account_devices` row is what takes it off the list.
  const remoteRows = createQuery(
    () => sql<DeviceRow>`
    SELECT d.id, d.last_seen_at, d.created_at
    FROM auth_devices d
    LEFT JOIN auth_account_devices m
      ON m.device_id = d.id AND m.user_id = d.user_id
    WHERE d.user_id = ${scopedAccountId()}
      AND d.deleted_at IS NULL
      AND (m.id IS NULL OR m.deleted_at IS NULL)
    LIMIT 500
  `
  );

  const ids = createMemo(() => {
    if (!paintReady()) return [];
    return sortDeviceIds(
      buildLastSeenMap({
        accountId: accountId(),
        remoteDevices: remoteRows.rows(),
        localDevices: localRows.rows(),
      }),
      currentDeviceId()
    );
  });
  const isLoading = createMemo(
    () => !paintReady() || localRows.isLoading() || remoteRows.isLoading()
  );
  return { ids, isLoading };
}
