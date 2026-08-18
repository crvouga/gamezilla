import { useNetworkState } from '@apps/client/device/device-ports-provider';
import { useConfigService } from '@libs/auth/public/config-service-context';
import { type Timers, useClock, useTimers } from '@pkgs/clock';
import type { HttpFetch } from '@pkgs/http-client';
import { useHttpClient } from '@pkgs/http-client';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type HealthCheckPhase = 'idle' | 'loading' | 'success' | 'error';

export type ServerHealthState = {
  phase: HealthCheckPhase;
  latencyMs: number | null;
  errorMessage: string | null;
  healthUrl: string;
};

const FETCH_TIMEOUT_MS = 8000;

async function fetchHealth(args: {
  readonly healthUrl: string;
  readonly outerSignal: AbortSignal;
  readonly httpFetch: HttpFetch;
  readonly timers: Timers;
  readonly now: () => number;
}): Promise<{ latencyMs: number }> {
  const { healthUrl, outerSignal, httpFetch, timers, now } = args;
  const combined = new AbortController();
  const onOuterAbort = () => combined.abort();
  outerSignal.addEventListener('abort', onOuterAbort);
  const timeoutId = timers.setTimeout(() => combined.abort(), FETCH_TIMEOUT_MS);

  const t0 = now();

  try {
    const res = await httpFetch(healthUrl, {
      method: 'GET',
      signal: combined.signal,
    });
    const latencyMs = Math.round(now() - t0);
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
    timers.clearTimeout(timeoutId);
    outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

function useHealthUrl(apiUrl: string): string {
  return useMemo(() => {
    const base = apiUrl.replace(/\/+$/, '');
    return `${base}/api/health`;
  }, [apiUrl]);
}

function useHealthState(
  healthUrl: string,
  httpFetch: HttpFetch,
  timers: Timers,
  now: () => number
) {
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

    void fetchHealth({
      healthUrl,
      outerSignal: ac.signal,
      httpFetch,
      timers,
      now,
    })
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
  }, [healthUrl, httpFetch, now, timers]);

  useEffect(() => {
    const ac = runCheck();
    return () => ac.abort();
  }, [runCheck]);

  return { health, runCheck };
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
  const { fetch: httpFetch } = useHttpClient();
  const clock = useClock();
  const timers = useTimers();
  const networkState = useNetworkState();

  const apiUrl = config.getApiUrl();
  const healthUrl = useHealthUrl(apiUrl);
  const { health, runCheck } = useHealthState(
    healthUrl,
    httpFetch,
    timers,
    clock.now
  );

  const refresh = useCallback(() => {
    runCheck();
  }, [runCheck]);

  const aggregateStatus = useMemo(
    () => computeAggregateStatus(networkState.isConnected, health.phase),
    [networkState.isConnected, health.phase]
  );

  return {
    apiUrl,
    healthUrl,
    networkState,
    health,
    aggregateStatus,
    refresh,
  };
}
