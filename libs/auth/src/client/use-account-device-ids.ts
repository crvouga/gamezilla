import { sql } from '@pkgs/sql';

import {
  useQuery,
  useSyncEngine,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';
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

/**
 * Device ids for the given account, plus the current install row when
 * signed in. Sorted with the current device first, then by `last_seen_at`
 * descending (falling back to `created_at`).
 */
export function useAccountDeviceIds(accountId: string | null): string[] {
  const { paintReady } = useSyncEngine();
  const currentDeviceId = useMyDeviceId();
  const scopedAccountId = paintReady ? accountId : null;
  const scopedDeviceId = paintReady ? currentDeviceId : '';

  const { rows: localRows } = useQuery(sql<DeviceRow>`
    SELECT id, last_seen_at, created_at
    FROM devices
    WHERE id = ${scopedDeviceId}
  `);

  const { rows: remoteRows } = useQuery(sql<DeviceRow>`
    SELECT id, last_seen_at, created_at
    FROM devices
    WHERE user_id = ${scopedAccountId}
    LIMIT 500
  `);

  return useMemo(() => {
    if (!paintReady) return [];
    return sortDeviceIds(
      buildLastSeenMap({
        accountId,
        remoteDevices: remoteRows,
        localDevices: localRows,
      }),
      currentDeviceId
    );
  }, [paintReady, accountId, remoteRows, localRows, currentDeviceId]);
}
