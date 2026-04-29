import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  Button,
  Card,
  ScreenBase,
  StatusDot,
  Text,
} from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { NetworkStateType } from 'expo-network';
import { useCallback, useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15_000;

const NETWORK_TYPE_LABELS: Record<NetworkStateType, string> = {
  [NetworkStateType.NONE]: 'None',
  [NetworkStateType.UNKNOWN]: 'Unknown',
  [NetworkStateType.WIFI]: 'Wi‑Fi',
  [NetworkStateType.CELLULAR]: 'Cellular',
  [NetworkStateType.ETHERNET]: 'Ethernet',
  [NetworkStateType.BLUETOOTH]: 'Bluetooth',
  [NetworkStateType.VPN]: 'VPN',
  [NetworkStateType.WIMAX]: 'WiMAX',
  [NetworkStateType.OTHER]: 'Other',
};

function formatNetworkType(type: NetworkStateType | undefined): string {
  if (type === undefined) return 'Unknown';
  return NETWORK_TYPE_LABELS[type] ?? String(type);
}

type ServerStatus = ReturnType<typeof useServerStatus>;

function OverallRow({ aggregateStatus }: { aggregateStatus: ServerStatus['aggregateStatus'] }) {
  const label =
    aggregateStatus === 'online'
      ? 'Online'
      : aggregateStatus === 'offline'
        ? 'Offline'
        : 'Limited or checking';
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <StatusDot status={aggregateStatus} size={12} />
      <Text variant="bodyBold" label={<Trans>Overall</Trans>} />
      <Text variant="body" label={label} />
    </Box>
  );
}

function DeviceNetworkCard({ networkState }: { networkState: ServerStatus['networkState'] }) {
  const networkLine =
    networkState.isConnected === false
      ? 'Disconnected'
      : networkState.isConnected === true
        ? 'Connected'
        : 'Checking…';
  const reachable =
    networkState.isInternetReachable === undefined
      ? '—'
      : networkState.isInternetReachable
        ? 'Yes'
        : 'No';
  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="bodyBold" label={<Trans>Device network</Trans>} />
      <Text variant="body" label={`Status: ${networkLine}`} />
      <Text variant="caption" label={`Type: ${formatNetworkType(networkState.type)}`} />
      <Text variant="caption" label={`Internet reachable: ${reachable}`} />
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
  const serverLine =
    health.phase === 'loading'
      ? 'Checking…'
      : health.phase === 'success'
        ? 'Reachable'
        : health.phase === 'error'
          ? 'Unreachable'
          : '…';
  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="bodyBold" label={<Trans>Server health</Trans>} />
      <Text variant="caption" selectable label={healthUrl} />
      <Text variant="body" label={`Status: ${serverLine}`} />
      {health.latencyMs !== null ? (
        <Text variant="caption" label={`Latency: ${health.latencyMs} ms`} />
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
  const nav = useBreadcrumbNav();
  const { apiUrl, healthUrl, networkState, health, aggregateStatus, refresh } =
    useServerStatus();

  const stableRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      stableRefresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [stableRefresh]);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        {
          name: 'Connection',
          subtitle: 'Network and API status',
        },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={{ ...sx, gap: 12 }}>
          <OverallRow aggregateStatus={aggregateStatus} />
          <DeviceNetworkCard networkState={networkState} />
          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label={<Trans>API endpoint</Trans>} />
            <Text variant="body" selectable label={apiUrl} />
          </Card>
          <ServerHealthCard healthUrl={healthUrl} health={health} />
          <Button
            title="Check again"
            onPress={stableRefresh}
            disabled={health.phase === 'loading'}
          />
        </Box>
      )}
    />
  );
}
