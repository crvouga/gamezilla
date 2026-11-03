import { useClipboard } from '@pkgs/device-client-ts/solid';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { AccountDeviceDetailScreenView } from './account-device-detail-screen-view';
import { useAccountDevice } from './use-account-device';

function normalizeDeviceId(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  if (raw.trim().length === 0) return null;
  return raw.trim();
}

/** `/more/account/device/:deviceId`: wires the detail view to sync. */
export function AccountDeviceDetailScreen(): JSX.Element {
  const params = useLocalSearchParams<{ deviceId?: string | undefined }>();
  const clipboard = useClipboard();
  const deviceId = createMemo(() => normalizeDeviceId(params().deviceId));
  const row = useAccountDevice(() => deviceId() ?? '');
  const status = () => {
    if (deviceId() === null) return 'missingId';
    if (row.isLoading()) return 'loading';
    return row.device() === null ? 'notFound' : 'ready';
  };
  return (
    <AccountDeviceDetailScreenView
      status={status()}
      device={row.device()}
      copy={(text) => clipboard.writeText(text)}
    />
  );
}
