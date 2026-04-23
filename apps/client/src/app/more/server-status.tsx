import { useServerStatus } from '@gamezilla/client/features/connection/use-server-status';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  Box,
  Button,
  Card,
  ScreenBase,
  StatusDot,
  Text,
} from '@gamezilla/shared/ui';
import { NetworkStateType } from 'expo-network';
import { useCallback, useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15_000;

function formatNetworkType(type: NetworkStateType | undefined): string {
  if (type === undefined) {
    return 'Unknown';
  }
  switch (type) {
    case NetworkStateType.NONE:
      return 'None';
    case NetworkStateType.UNKNOWN:
      return 'Unknown';
    case NetworkStateType.WIFI:
      return 'Wi‑Fi';
    case NetworkStateType.CELLULAR:
      return 'Cellular';
    case NetworkStateType.ETHERNET:
      return 'Ethernet';
    case NetworkStateType.BLUETOOTH:
      return 'Bluetooth';
    case NetworkStateType.VPN:
      return 'VPN';
    case NetworkStateType.WIMAX:
      return 'WiMAX';
    case NetworkStateType.OTHER:
      return 'Other';
    default:
      return String(type);
  }
}

export default function ServerStatusScreen() {
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

  const networkLine =
    networkState.isConnected === false
      ? 'Disconnected'
      : networkState.isConnected === true
        ? 'Connected'
        : 'Checking…';

  const serverLine =
    health.phase === 'loading'
      ? 'Checking…'
      : health.phase === 'success'
        ? 'Reachable'
        : health.phase === 'error'
          ? 'Unreachable'
          : '…';

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
          <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <StatusDot status={aggregateStatus} size={12} />
            <Text variant="bodyBold" label="Overall" />
            <Text
              variant="body"
              label={
                aggregateStatus === 'online'
                  ? 'Online'
                  : aggregateStatus === 'offline'
                    ? 'Offline'
                    : 'Limited or checking'
              }
            />
          </Box>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label="Device network" />
            <Text variant="body" label={`Status: ${networkLine}`} />
            <Text
              variant="caption"
              label={`Type: ${formatNetworkType(networkState.type)}`}
            />
            <Text
              variant="caption"
              label={`Internet reachable: ${
                networkState.isInternetReachable === undefined
                  ? '—'
                  : networkState.isInternetReachable
                    ? 'Yes'
                    : 'No'
              }`}
            />
          </Card>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label="API endpoint" />
            <Text variant="body" selectable label={apiUrl} />
          </Card>

          <Card elevation={1} sx={{ p: 4, gap: 2 }}>
            <Text variant="bodyBold" label="Server health" />
            <Text variant="caption" selectable label={healthUrl} />
            <Text variant="body" label={`Status: ${serverLine}`} />
            {health.latencyMs !== null ? (
              <Text
                variant="caption"
                label={`Latency: ${health.latencyMs} ms`}
              />
            ) : null}
            {health.errorMessage !== null ? (
              <Text
                variant="caption"
                sx={{ color: 'destructive' }}
                label={health.errorMessage}
              />
            ) : null}
          </Card>

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
