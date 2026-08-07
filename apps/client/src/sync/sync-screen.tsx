import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import { Box, ScreenBase, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

function StatusRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 3,
        py: 2,
      }}
    >
      <Text variant="body" sx={{ flexShrink: 0 }} label={label} />
      <Text
        variant="body"
        selectable
        sx={{
          fontWeight: '600',
          flex: 1,
          minWidth: 0,
          textAlign: 'right',
        }}
        label={value}
      />
    </Box>
  );
}

export function SyncScreen() {
  const nav = useBreadcrumbNav();
  const { t } = useLingui();
  const { status } = useSyncEngine();

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
      screenId="sync"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
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
        </Box>
      )}
    />
  );
}
