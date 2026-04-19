import { ConfigServiceToken } from '@gamezilla/shared/config/config-service';
import { useDependency } from '@gamezilla/shared/dependency-injection/react';
import { useNetworkState } from 'expo-network';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type HealthCheckPhase = 'idle' | 'loading' | 'success' | 'error';

export type ServerHealthState = {
  phase: HealthCheckPhase;
  latencyMs: number | null;
  errorMessage: string | null;
  healthUrl: string;
};

const FETCH_TIMEOUT_MS = 8000;

async function fetchHealth(
  healthUrl: string,
  outerSignal: AbortSignal
): Promise<{ latencyMs: number }> {
  const combined = new AbortController();
  const onOuterAbort = () => combined.abort();
  outerSignal.addEventListener('abort', onOuterAbort);
  const timeoutId = setTimeout(() => combined.abort(), FETCH_TIMEOUT_MS);

  const t0 =
    typeof performance !== 'undefined' && performance.now !== undefined
      ? performance.now()
      : Date.now();

  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: combined.signal,
    });
    const t1 =
      typeof performance !== 'undefined' && performance.now !== undefined
        ? performance.now()
        : Date.now();
    const latencyMs = Math.round(t1 - t0);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json: unknown = await res.json();
    if (
      json === null ||
      typeof json !== 'object' ||
      (json as { status?: unknown }).status !== 'ok'
    ) {
      throw new Error('Unexpected health response');
    }
    return { latencyMs };
  } finally {
    clearTimeout(timeoutId);
    outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

export function useServerStatus() {
  const config = useDependency(ConfigServiceToken);
  const networkState = useNetworkState();

  const apiUrl = config.getApiUrl();
  const healthUrl = useMemo(() => {
    const base = apiUrl.replace(/\/+$/, '');
    return `${base}/health`;
  }, [apiUrl]);

  const [health, setHealth] = useState<ServerHealthState>({
    phase: 'loading',
    latencyMs: null,
    errorMessage: null,
    healthUrl,
  });

  useEffect(() => {
    setHealth((h) => ({ ...h, healthUrl }));
  }, [healthUrl]);

  const runCheck = useCallback(() => {
    const ac = new AbortController();
    setHealth((h) => ({
      ...h,
      phase: 'loading',
      errorMessage: null,
      healthUrl,
    }));

    void fetchHealth(healthUrl, ac.signal)
      .then(({ latencyMs }) => {
        if (ac.signal.aborted) return;
        setHealth({
          phase: 'success',
          latencyMs,
          errorMessage: null,
          healthUrl,
        });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : 'Health check failed';
        setHealth({
          phase: 'error',
          latencyMs: null,
          errorMessage: message,
          healthUrl,
        });
      });

    return ac;
  }, [healthUrl]);

  const refresh = useCallback(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    const ac = runCheck();
    return () => ac.abort();
  }, [runCheck]);

  const explicitlyOffline = networkState.isConnected === false;

  const aggregateStatus = useMemo((): 'online' | 'offline' | 'warning' => {
    if (explicitlyOffline) {
      return 'offline';
    }
    if (health.phase === 'loading') {
      return 'warning';
    }
    if (health.phase === 'success') {
      return 'online';
    }
    return 'warning';
  }, [explicitlyOffline, health.phase]);

  return {
    apiUrl,
    healthUrl,
    networkState,
    health,
    aggregateStatus,
    refresh,
  };
}
