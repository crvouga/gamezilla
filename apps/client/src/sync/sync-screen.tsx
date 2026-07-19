import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { useSyncStatus } from '@pkgs/sync-engine/client/sync-engine-context';
import { Box, ScreenBase, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ flexDirection: 'row', justifyContent: 'space-between', py: 2 }}>
      <Text variant="body" label={label} />
      <Text variant="body" sx={{ fontWeight: '600' }} label={value} />
    </Box>
  );
}

export function SyncScreen() {
  const nav = useBreadcrumbNav();
  const { t } = useLingui();
  const status = useSyncStatus();
  const powersyncUrl = process.env['EXPO_PUBLIC_PS_URL'] ?? t`Not configured`;

  const connectionLabel =
    status.connection === 'disconnected'
      ? t`Disconnected`
      : status.connection === 'connecting'
        ? t`Connecting`
        : status.connection === 'syncing'
          ? t`Syncing`
          : t`Connected`;

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        { name: <Trans>Sync status</Trans> },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <StatusRow label={t`Connection`} value={connectionLabel} />
          <StatusRow label={t`Online`} value={status.online ? t`Yes` : t`No`} />
          <StatusRow
            label={t`Has synced`}
            value={status.hasSynced ? t`Yes` : t`No`}
          />
          <StatusRow
            label={t`Has ever synced`}
            value={status.hasEverSynced ? t`Yes` : t`No`}
          />
          <StatusRow
            label={t`Last error`}
            value={status.lastError ?? t`None`}
          />
          <StatusRow label={t`PowerSync URL`} value={powersyncUrl} />
        </Box>
      )}
    />
  );
}
