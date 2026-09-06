import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSyncEngine } from '@pkgs/sync-engine/client';
import {
  Box,
  Button,
  MenuRow,
  MenuSection,
  RefreshCwIcon,
  ScreenBase,
  StatusDot,
  type StatusDotStatus,
  Text,
} from '@pkgs/ui';
import { useCallback } from 'react';

const STATUS_DOT_SIZE = 12;
const BUTTON_ICON_SIZE = 16;

function connectionDotStatus(
  connection: string,
  hasError: boolean
): StatusDotStatus {
  if (hasError) return 'warning';
  if (connection === 'connected') return 'online';
  if (connection === 'disconnected') return 'offline';
  return 'pending';
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
  const yes = t`Yes`;
  const no = t`No`;

  return (
    <ScreenBase
      screenId="sync"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Sync</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <MenuSection>
            <MenuRow
              title={t`Connection`}
              value={connectionLabel}
              trailing={
                <StatusDot
                  status={connectionDotStatus(
                    status.connection,
                    lastError !== null
                  )}
                  size={STATUS_DOT_SIZE}
                />
              }
            />
          </MenuSection>
          <MenuSection
            title={<Trans>State</Trans>}
            {...(lastError !== null
              ? {
                  footer: (
                    <Text
                      variant="caption"
                      selectable
                      sx={{ color: 'destructive' }}
                      label={lastError}
                    />
                  ),
                }
              : {})}
          >
            <MenuRow title={t`Online`} value={status.online ? yes : no} />
            <MenuRow
              title={t`Has synced`}
              value={status.hasSynced ? yes : no}
            />
            <MenuRow
              title={t`Has ever synced`}
              value={status.hasEverSynced ? yes : no}
            />
            <MenuRow
              title={t`Last error`}
              value={lastError === null ? t`None` : t`See below`}
            />
          </MenuSection>
          <Box sx={{ alignSelf: 'stretch' }}>
            <Button
              title={t`Retry sync`}
              intent="neutral"
              variant="outline"
              startIcon={<RefreshCwIcon size={BUTTON_ICON_SIZE} />}
              onPress={onRetry}
            />
          </Box>
        </Box>
      )}
    />
  );
}
