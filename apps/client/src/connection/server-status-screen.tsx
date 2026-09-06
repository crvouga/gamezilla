import { useServerStatus } from '@apps/client/connection/use-server-status';
import { NetworkStateType } from '@apps/client/device/ports';
import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import {
  Box,
  Button,
  MenuRow,
  MenuSection,
  RefreshCwIcon,
  ScreenBase,
  StatusDot,
  Text,
} from '@pkgs/ui';
import { useCallback, useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15_000;
const STATUS_DOT_SIZE = 12;
const BUTTON_ICON_SIZE = 16;

function useNetworkTypeLabel(): (type: NetworkStateType | undefined) => string {
  const { t } = useLingui();
  const labels: Record<NetworkStateType, string> = {
    [NetworkStateType.NONE]: t`None`,
    [NetworkStateType.UNKNOWN]: t`Unknown`,
    [NetworkStateType.WIFI]: String('Wi‑Fi'),
    [NetworkStateType.CELLULAR]: t`Cellular`,
    [NetworkStateType.ETHERNET]: t`Ethernet`,
    [NetworkStateType.BLUETOOTH]: t`Bluetooth`,
    [NetworkStateType.VPN]: String('VPN'),
    [NetworkStateType.WIMAX]: String('WiMAX'),
    [NetworkStateType.OTHER]: t`Other`,
  };
  return (type: NetworkStateType | undefined): string => {
    if (type === undefined) return t`Unknown`;
    return labels[type] ?? String(type);
  };
}

type ServerStatus = ReturnType<typeof useServerStatus>;

function OverallSection({
  aggregateStatus,
}: {
  aggregateStatus: ServerStatus['aggregateStatus'];
}) {
  const { t } = useLingui();
  const label =
    aggregateStatus === 'online'
      ? t`Online`
      : aggregateStatus === 'offline'
        ? t`Offline`
        : t`Limited or checking`;
  return (
    <MenuSection>
      <MenuRow
        title={<Trans>Overall</Trans>}
        value={label}
        trailing={<StatusDot status={aggregateStatus} size={STATUS_DOT_SIZE} />}
      />
    </MenuSection>
  );
}

function DeviceNetworkSection({
  networkState,
  health,
}: {
  networkState: ServerStatus['networkState'];
  health: ServerStatus['health'];
}) {
  const { t } = useLingui();
  const formatNetworkType = useNetworkTypeLabel();
  const networkLine =
    networkState.isConnected === false
      ? t`Disconnected`
      : networkState.isConnected === true
        ? t`Connected`
        : t`Checking…`;
  const reachable =
    networkState.isInternetReachable === undefined
      ? '—'
      : networkState.isInternetReachable
        ? t`Yes`
        : t`No`;
  const networkTypeLabel = formatNetworkType(networkState.type);
  // The OS-reported network state can disagree with reality (especially on
  // web). When the server is actually reachable, surface a note explaining
  // the discrepancy instead of leaving the section looking contradictory.
  const osReportsOffline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;
  const showDiscrepancyNote = health.phase === 'success' && osReportsOffline;
  return (
    <MenuSection
      title={<Trans>Device network</Trans>}
      {...(showDiscrepancyNote
        ? {
            footer: t`The OS reports the device as offline, but the server is reachable. This is usually a quirk of the platform's network reporting and can be ignored.`,
          }
        : {})}
    >
      <MenuRow title={t`Status`} value={networkLine} />
      <MenuRow title={t`Type`} value={networkTypeLabel} />
      <MenuRow title={t`Internet reachable`} value={reachable} />
    </MenuSection>
  );
}

function ServerHealthSection({
  apiUrl,
  healthUrl,
  health,
}: {
  apiUrl: string;
  healthUrl: string;
  health: ServerStatus['health'];
}) {
  const { t } = useLingui();
  const serverLine =
    health.phase === 'loading'
      ? t`Checking…`
      : health.phase === 'success'
        ? t`Reachable`
        : health.phase === 'error'
          ? t`Unreachable`
          : '…';
  const latencyMs = health.latencyMs;
  return (
    <MenuSection
      title={<Trans>Server</Trans>}
      {...(health.errorMessage !== null
        ? {
            footer: (
              <Text
                variant="caption"
                sx={{ color: 'destructive' }}
                label={health.errorMessage}
              />
            ),
          }
        : {})}
    >
      <MenuRow title={t`Status`} value={serverLine} />
      <MenuRow
        title={t`Latency`}
        value={latencyMs === null ? '—' : t`${latencyMs} ms`}
      />
      <MenuRow title={t`API endpoint`} caption={apiUrl} />
      <MenuRow title={t`Health check`} caption={healthUrl} />
    </MenuSection>
  );
}

export function ServerStatusScreen() {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const timers = useTimers();
  const { apiUrl, healthUrl, networkState, health, aggregateStatus, refresh } =
    useServerStatus();

  const stableRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = timers.setInterval(() => {
      stableRefresh();
    }, REFRESH_INTERVAL_MS);
    return () => timers.clearInterval(id);
  }, [stableRefresh, timers]);

  return (
    <ScreenBase
      screenId="server-status"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Connection</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <OverallSection aggregateStatus={aggregateStatus} />
          <DeviceNetworkSection networkState={networkState} health={health} />
          <ServerHealthSection
            apiUrl={apiUrl}
            healthUrl={healthUrl}
            health={health}
          />
          <Box sx={{ alignSelf: 'stretch' }}>
            <Button
              title={t`Check again`}
              intent="neutral"
              variant="outline"
              startIcon={<RefreshCwIcon size={BUTTON_ICON_SIZE} />}
              onPress={stableRefresh}
              loading={health.phase === 'loading'}
            />
          </Box>
        </Box>
      )}
    />
  );
}
