import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { useSyncStatus } from '@pkgs/sync-engine/client/sync-engine-context';
import { Box, ScreenBase, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { Platform, type TextStyle } from 'react-native';

/** URLs have no spaces; allow mid-token wrap on web (not in RN TextStyle). */
const WEB_BREAK_ALL_STYLE =
  Platform.OS === 'web' ? ({ wordBreak: 'break-all' } as TextStyle) : undefined;

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
        style={WEB_BREAK_ALL_STYLE}
        label={value}
      />
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
          <StatusRow label={t`PowerSync URL`} value={powersyncUrl} />
        </Box>
      )}
    />
  );
}
