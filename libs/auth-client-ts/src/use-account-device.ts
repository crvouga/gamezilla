import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import type {
  AccountDeviceRow,
  AccountDeviceView,
} from './account-device-view';
import { accountDeviceViewOf } from './account-device-view';
import { useDeviceSessionFacts } from './use-device-session-facts';

export type AccountDevice = {
  /** True until the local read of the device row has hydrated. */
  readonly isLoading: Accessor<boolean>;
  /** The device, or `null` when this copy does not hold its row. */
  readonly device: Accessor<AccountDeviceView | null>;
};

/** One device's synced row, read locally, for the device detail screen. */
export function useAccountDevice(deviceId: Accessor<string>): AccountDevice {
  const facts = useDeviceSessionFacts();
  const query = createQuery(
    () => sql<AccountDeviceRow>`
    SELECT
      id,
      created_at,
      platform,
      os_name,
      os_version,
      device_model_name,
      device_brand,
      device_name,
      app_version,
      app_build_number,
      user_agent,
      first_seen_at,
      last_seen_at
    FROM auth_devices
    WHERE id = ${deviceId()}
  `
  );
  const device = createMemo(() => {
    const row = query.rows()[0];
    return row === undefined ? null : accountDeviceViewOf(row, facts());
  });
  return { isLoading: query.isLoading, device };
}
