import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import { Box, Button, Card, ScreenBase, Text } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

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
  const { status, refreshQueries } = useSyncEngine();

  const connectionLabel =
    status.connection === 'disconnected'
      ? t`Disconnected`
      : status.connection === 'connecting'
        ? t`Connecting`
        : status.connection === 'syncing'
          ? t`Syncing`
          : t`Connected`;

  const onRetry = useCallback(() => {
    void refreshQueries();
  }, [refreshQueries]);

  const lastError =
    status.lastError !== null && status.lastError.length > 0
      ? status.lastError
      : null;

  return (
    <ScreenBase
      screenId="sync"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Sync status</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 3 }]}>
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
          {lastError !== null ? (
            <Card elevation={1} sx={{ p: 4, gap: 2 }}>
              <Text variant="bodyBold" label={<Trans>Last error</Trans>} />
              <Text
                variant="caption"
                selectable
                sx={{ color: 'destructive' }}
                label={lastError}
              />
            </Card>
          ) : (
            <StatusRow label={t`Last error`} value={t`None`} />
          )}
          <Button title={t`Retry sync`} onPress={onRetry} />
        </Box>
      )}
    />
  );
}
