/** @jsxImportSource solid-js */
/**
 * `ClientEnvProvider` — root of the product client tree. Projects the env's
 * nondeterminism ports (clock / timers / ids / server HTTP / mutation hold)
 * and its moderation
 * into the `@pkgs/*` Solid contexts so every screen reads them by hook.
 */

import { ModerationProvider } from '@libs/moderation-client/moderation-context';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { HttpClientProvider } from '@pkgs/http-client-client/solid';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { ExternalUrlProvider } from '@pkgs/ui-root-client/external-url';
import { MutationSuccessHoldProvider } from '@pkgs/ui-root-client/mutation-success-hold';
import { IdProvider } from '@pkgs/uuid-client/solid';
import { createContext, type JSX, untrack, useContext } from 'solid-js';

import type { ClientEnv } from './client-env';
import type { AppSyncEnginePool } from './sync-engine-pool';

const EnvContext = createContext<ClientEnv>();
const PoolContext = createContext<AppSyncEnginePool>();

export type ClientEnvProviderProps = {
  readonly env: ClientEnv;
  readonly syncEnginePool: AppSyncEnginePool;
  readonly children: JSX.Element;
};

export function ClientEnvProvider(props: ClientEnvProviderProps): JSX.Element {
  // Composition-root configuration: read once, not tracked.
  const env = untrack(() => props.env);
  const pool = untrack(() => props.syncEnginePool);
  const http: HttpClient = { fetch: env.server };
  return (
    <EnvContext.Provider value={env}>
      <PoolContext.Provider value={pool}>
        <ClockProvider clock={env.clock} timers={env.timers}>
          <HttpClientProvider value={http}>
            <ExternalUrlProvider value={env.openExternalUrl}>
              <IdProvider createId={env.createId} random={env.random}>
                <MutationSuccessHoldProvider
                  successHoldMs={env.mutationSuccessHoldMs}
                >
                  <ModerationProvider rules={env.moderation}>
                    {props.children}
                  </ModerationProvider>
                </MutationSuccessHoldProvider>
              </IdProvider>
            </ExternalUrlProvider>
          </HttpClientProvider>
        </ClockProvider>
      </PoolContext.Provider>
    </EnvContext.Provider>
  );
}

export function useClientEnv(): ClientEnv {
  const env = useContext(EnvContext);
  if (env === undefined) {
    throw new Error(
      'useClientEnv: ClientEnvProvider missing — wrap the tree with createClient'
    );
  }
  return env;
}

/** Soft read for trees that may mount without createClient (harness console). */
export function useOptionalClientEnv(): ClientEnv | undefined {
  return useContext(EnvContext);
}

export function useSyncEnginePool(): AppSyncEnginePool {
  const pool = useContext(PoolContext);
  if (pool === undefined) {
    throw new Error(
      'useSyncEnginePool: ClientEnvProvider missing — wrap the tree with createClient'
    );
  }
  return pool;
}
