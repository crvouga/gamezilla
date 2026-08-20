import type { AppSyncEnginePool } from '@apps/client/sync/sync-engine-pool';
import { ClockProvider } from '@pkgs/clock';
import { HttpClientProvider } from '@pkgs/http-client';
import { IdProvider } from '@pkgs/uuid';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ClientEnv } from './client-env';

const EnvCtx = createContext<ClientEnv | null>(null);
const PoolCtx = createContext<AppSyncEnginePool | null>(null);

export type ClientEnvProviderProps = {
  readonly env: ClientEnv;
  readonly syncEnginePool: AppSyncEnginePool;
  readonly children: ReactNode;
};

export function ClientEnvProvider(props: ClientEnvProviderProps): ReactNode {
  const { env, syncEnginePool, children } = props;
  const http = useMemo(() => ({ fetch: env.server }), [env]);
  return (
    <EnvCtx.Provider value={env}>
      <PoolCtx.Provider value={syncEnginePool}>
        <ClockProvider clock={env.clock} timers={env.timers}>
          <HttpClientProvider client={http}>
            <IdProvider createId={env.createId} random={env.random}>
              {children}
            </IdProvider>
          </HttpClientProvider>
        </ClockProvider>
      </PoolCtx.Provider>
    </EnvCtx.Provider>
  );
}

export function useClientEnv(): ClientEnv {
  const env = useContext(EnvCtx);
  if (env === null) {
    throw new Error(
      'useClientEnv: ClientEnvProvider missing — wrap the tree with createClient'
    );
  }
  return env;
}

/** Soft read for trees that may mount without createClient (sim console). */
export function useOptionalClientEnv(): ClientEnv | null {
  return useContext(EnvCtx);
}

export function useSyncEnginePool(): AppSyncEnginePool {
  const pool = useContext(PoolCtx);
  if (pool === null) {
    throw new Error(
      'useSyncEnginePool: ClientEnvProvider missing — wrap the tree with createClient'
    );
  }
  return pool;
}
