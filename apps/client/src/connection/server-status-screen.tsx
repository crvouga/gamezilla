import { useServerStatus } from '@apps/client/connection/use-server-status';
import { NetworkStateType } from '@apps/client/device/ports';
import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { Box, Button, Card, ScreenBase, StatusDot, Text } from '@pkgs/ui';
import { useCallback, useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15_000;

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

function OverallRow({
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
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <StatusDot status={aggregateStatus} size={12} />
      <Text variant="bodyBold" label={<Trans>Overall</Trans>} />
      <Text variant="body" label={label} />
    </Box>
  );
}

function DeviceNetworkCard({
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
  // the discrepancy instead of leaving the card looking contradictory.
  const osReportsOffline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;
  const showDiscrepancyNote = health.phase === 'success' && osReportsOffline;
  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="bodyBold" label={<Trans>Device network</Trans>} />
      <Text variant="body" label={t`Status: ${networkLine}`} />
      <Text variant="caption" label={t`Type: ${networkTypeLabel}`} />
      <Text variant="caption" label={t`Internet reachable: ${reachable}`} />
      {showDiscrepancyNote ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={t`The OS reports the device as offline, but the server is reachable. This is usually a quirk of the platform's network reporting and can be ignored.`}
        />
      ) : null}
    </Card>
  );
}

function ServerHealthCard({
  healthUrl,
  health,
}: {
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
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="bodyBold" label={<Trans>Server health</Trans>} />
      <Text variant="caption" selectable label={healthUrl} />
      <Text variant="body" label={t`Status: ${serverLine}`} />
      {latencyMs !== null ? (
        <Text variant="caption" label={t`Latency: ${latencyMs} ms`} />
      ) : null}
      {health.errorMessage !== null ? (
        <Text
          variant="caption"
          sx={{ color: 'destructive' }}
          label={health.errorMessage}
        />
      ) : null}
    </Card>
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
        <Box sx={[sx, { gap: 3 }]}>
          <OverallRow aggregateStatus={aggregateStatus} />
          <DeviceNetworkCard networkState={networkState} health={health} />
          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label={<Trans>API endpoint</Trans>} />
            <Text variant="body" selectable label={apiUrl} />
          </Card>
          <ServerHealthCard healthUrl={healthUrl} health={health} />
          <Button
            title={t`Check again`}
            onPress={stableRefresh}
            disabled={health.phase === 'loading'}
          />
        </Box>
      )}
    />
  );
}
