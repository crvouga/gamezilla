/** @jsxImportSource solid-js */
/**
 * The only client constructor — wall (`main.tsx`) and sims pass different
 * `ClientEnv` implementations and different feature sets. `App` owns the
 * router: the browser `Router` (URL is the source of truth) or, when
 * `embedded`, a `MemoryRouter` so several product Apps can share one page (or
 * a test can drive `history`).
 *
 * The shell names no feature. Routes, tabs, docks and providers all come from
 * the `features` fold, so booting one bounded context and booting all of them
 * is the same code path with a different argument — which is what lets a
 * feature's own e2e run the real shell.
 */

import type { FeatureClient } from '@libs/feature/public/client';
import { composeFeatureClients } from '@libs/feature/public/compose-client';
import {
  type MemoryHistory,
  MemoryRouter,
  Router,
  type RouteSectionProps,
} from '@solidjs/router';
import { type Component, type JSX, Show, untrack } from 'solid-js';

import { buildRouteTable } from '../routes/route-table';
import { buildAppRoutes } from '../routes/routes';
import {
  type AppComposition,
  AppCompositionProvider,
  type LoadComposedFeatures,
} from './app-features-context';
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

export type CreateClientArgs = CreateClientOptions & {
  /**
   * The bounded contexts this client runs. Production passes every feature;
   * a subsystem harness passes the platform plus the one under test. The
   * shell itself names none of them.
   */
  readonly features: readonly FeatureClient[];
  /**
   * The same features' data halves — schema, queries, wake topics, writes —
   * behind a thunk. The shell holds no product registry of its own, and the
   * fold must not reach the entry chunk: it is first needed when the local
   * database opens, well after first paint.
   */
  readonly loadApp: LoadComposedFeatures;
};

function makeRoot(embedded: boolean): Component<RouteSectionProps> {
  return (props) => (
    <ProductApp embedded={embedded}>{props.children}</ProductApp>
  );
}

export function createClient(env: ClientEnv, args: CreateClientArgs): Client {
  const syncEnginePool = createAppSyncEnginePool({
    loadMutations: async () => await (await args.loadApp()).mutations(),
    ...(args.poolGlobalKey === undefined
      ? {}
      : { globalKey: args.poolGlobalKey }),
  });
  const composition: AppComposition = {
    clients: composeFeatureClients(args.features),
    loadApp: args.loadApp,
  };
  const routes = buildAppRoutes(buildRouteTable(composition.clients.routes));
  const App = (props: ClientAppProps): JSX.Element => {
    // Composition-root configuration: read once, not tracked.
    const { embedded, history } = untrack(() => ({
      embedded: props.embedded === true,
      history: props.history,
    }));
    return (
      <ClientEnvProvider env={env} syncEnginePool={syncEnginePool}>
        <AppCompositionProvider value={composition}>
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
        </AppCompositionProvider>
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
