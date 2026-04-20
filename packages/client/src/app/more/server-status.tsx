import { useServerStatus } from '@/features/connection/use-server-status';
import { ScreenHeader } from '@/ui/screen-header';
import { getKnownServerNameForApiUrl } from '@gamezilla/shared/config/api-servers';
import {
  Box,
  Button,
  Card,
  ScrollView,
  StatusDot,
  Text,
} from '@gamezilla/shared/ui';
import { NetworkStateType } from 'expo-network';
import { useCallback, useEffect, useMemo } from 'react';

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
  const { apiUrl, healthUrl, networkState, health, aggregateStatus, refresh } =
    useServerStatus();

  const knownName = useMemo(
    () => getKnownServerNameForApiUrl(apiUrl),
    [apiUrl]
  );

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
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Connection"
        subtitle="Network and API status"
        fallbackHref="/more"
      />
      <ScrollView
        sx={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Box sx={{ px: 4, pt: 4, gap: 4 }}>
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
            {knownName !== undefined ? (
              <Text variant="caption" label={`Known as: ${knownName}`} />
            ) : (
              <Text variant="caption" label="Known as: custom / not in list" />
            )}
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
            onPressIn={stableRefresh}
            disabled={health.phase === 'loading'}
          />
        </Box>
      </ScrollView>
    </Box>
  );
}
