import {
  type AppSyncEnginePool,
  createAppSyncEnginePool,
} from '@apps/client/sync/sync-engine-pool';
import type { FunctionComponent } from 'react';
import { ProductApp } from './app';
import type { ClientEnv } from './client-env';
import { ClientEnvProvider } from './client-env-provider';

export type Client = {
  readonly env: ClientEnv;
  readonly syncEnginePool: AppSyncEnginePool;
  readonly App: FunctionComponent<{ readonly embedded?: boolean }>;
  close(): Promise<void>;
};

/** The only client constructor — wall and sim pass different env implementations. */
export function createClient(env: ClientEnv): Client {
  const syncEnginePool: AppSyncEnginePool = createAppSyncEnginePool();
  const App: FunctionComponent<{ readonly embedded?: boolean }> = (props) => {
    return (
      <ClientEnvProvider env={env} syncEnginePool={syncEnginePool}>
        <ProductApp embedded={props.embedded === true} />
      </ClientEnvProvider>
    );
  };
  return {
    env,
    syncEnginePool,
    App,
    close: () => syncEnginePool.releaseAll(),
  };
}
