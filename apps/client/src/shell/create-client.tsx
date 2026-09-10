/** @jsxImportSource solid-js */
/**
 * The only client constructor — wall (`main.tsx`) and sims pass different
 * `ClientEnv` implementations. `App` owns the router: the browser `Router`
 * (URL is the source of truth) or, when `embedded`, a `MemoryRouter` so
 * several product Apps can share one page (or a test can drive `history`).
 */

import {
  type MemoryHistory,
  MemoryRouter,
  Router,
  type RouteSectionProps,
} from '@solidjs/router';
import { type Component, type JSX, Show, untrack } from 'solid-js';

import { buildAppRoutes } from '../routes/routes';
import type { ClientEnv } from './client-env';
import { ClientEnvProvider } from './client-env-context';
import { ProductApp } from './product-app';
import {
  type AppSyncEnginePool,
  createAppSyncEnginePool,
} from './sync/sync-engine-pool';

export type ClientAppProps = {
  /** Multi-App product-simulator / tests: in-memory router, no document shortcuts. */
  readonly embedded?: boolean | undefined;
  /** Embedded only: externally owned history (tests drive navigation). */
  readonly history?: MemoryHistory | undefined;
};

export type Client = {
  readonly env: ClientEnv;
  readonly syncEnginePool: AppSyncEnginePool;
  readonly App: Component<ClientAppProps>;
  close(): Promise<void>;
};

export type CreateClientOptions = {
  /** Stable key so the engine pool survives HMR (production only). */
  readonly poolGlobalKey?: string | undefined;
};

function makeRoot(embedded: boolean): Component<RouteSectionProps> {
  return (props) => (
    <ProductApp embedded={embedded}>{props.children}</ProductApp>
  );
}

export function createClient(
  env: ClientEnv,
  options?: CreateClientOptions
): Client {
  const syncEnginePool = createAppSyncEnginePool(
    options?.poolGlobalKey === undefined
      ? undefined
      : { globalKey: options.poolGlobalKey }
  );
  const App = (props: ClientAppProps): JSX.Element => {
    // Composition-root configuration: read once, not tracked.
    const { embedded, history } = untrack(() => ({
      embedded: props.embedded === true,
      history: props.history,
    }));
    const routes = buildAppRoutes();
    return (
      <ClientEnvProvider env={env} syncEnginePool={syncEnginePool}>
        <Show
          when={embedded}
          fallback={<Router root={makeRoot(false)}>{routes}</Router>}
        >
          <MemoryRouter
            root={makeRoot(true)}
            {...(history === undefined ? {} : { history })}
          >
            {routes}
          </MemoryRouter>
        </Show>
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
