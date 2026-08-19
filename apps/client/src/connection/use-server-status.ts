import { useNetworkState } from '@apps/client/device/device-ports-provider';
import { useConfigService } from '@libs/auth/public/config-service-context';
import {
  type OriginAvailabilitySnapshot,
  useOptionalOriginAvailability,
  useOriginAvailabilitySnapshot,
} from '@pkgs/http-client';
import { useCallback, useMemo } from 'react';

export type HealthCheckPhase = 'idle' | 'loading' | 'success' | 'error';

export type ServerHealthState = {
  phase: HealthCheckPhase;
  latencyMs: number | null;
  errorMessage: string | null;
  healthUrl: string;
};

function healthFromSnapshot(
  snapshot: OriginAvailabilitySnapshot
): ServerHealthState {
  if (snapshot.phase === 'available') {
    return {
      phase: 'success',
      latencyMs: snapshot.lastLatencyMs,
      errorMessage: null,
      healthUrl: snapshot.healthUrl,
    };
  }
  if (snapshot.phase === 'probing') {
    return {
      phase: 'loading',
      latencyMs: snapshot.lastLatencyMs,
      errorMessage: null,
      healthUrl: snapshot.healthUrl,
    };
  }
  return {
    phase: 'error',
    latencyMs: null,
    errorMessage: 'API unavailable',
    healthUrl: snapshot.healthUrl,
  };
}

function computeAggregateStatus(
  isConnected: boolean | null | undefined,
  phase: HealthCheckPhase
): 'online' | 'offline' | 'warning' {
  if (phase === 'success') return 'online';
  if (phase === 'loading') return 'warning';
  if (isConnected === false) return 'offline';
  return 'warning';
}

export function useServerStatus() {
  const config = useConfigService();
  const snapshot = useOriginAvailabilitySnapshot();
  const availability = useOptionalOriginAvailability();
  const networkState = useNetworkState();
  const apiUrl = config.getApiUrl();
  const health = useMemo(() => healthFromSnapshot(snapshot), [snapshot]);

  const refresh = useCallback(() => {
    void availability?.refresh();
  }, [availability]);

  const aggregateStatus = useMemo(
    () => computeAggregateStatus(networkState.isConnected, health.phase),
    [networkState.isConnected, health.phase]
  );

  return {
    apiUrl,
    healthUrl: health.healthUrl,
    networkState,
    health,
    aggregateStatus,
    refresh,
  };
}
