/** @jsxImportSource solid-js */
/**
 * The feature set this client was composed from.
 *
 * `createClient(env, { features, loadApp })` publishes both halves here:
 * `features` is what the UI is made of (routes, tabs, providers), `loadApp`
 * resolves what sync is made of (schema, queries, wake topics, mutations).
 * The chrome can ask what tabs exist and the sync boot can ask what schema to
 * open without either of them naming a feature — which is why a shell running
 * one bounded context and a shell running nine are the same code.
 *
 * The sync half is behind a thunk because it is not needed until the local
 * database opens, which is after first paint by design. Resolving it eagerly
 * would put every feature's manifest on the entry chunk — the low-end Android
 * critical-path gate catches exactly that.
 */

import type { ComposedFeatures } from '@libs/feature/public/compose';
import type { ComposedFeatureClients } from '@libs/feature/public/compose-client';
import { defineContext } from '@pkgs/solid-context/define-context';

export type LoadComposedFeatures = () => Promise<ComposedFeatures>;

export type AppComposition = {
  readonly clients: ComposedFeatureClients;
  readonly loadApp: LoadComposedFeatures;
};

const AppCompositionContext = defineContext<AppComposition>('AppComposition');

export const AppCompositionProvider = AppCompositionContext.Provider;

/** The UI half: routes, tabs, docks, providers. */
export function useAppFeatures(): ComposedFeatureClients {
  return AppCompositionContext.use().clients;
}

/** The sync half: schema, queries, session queries, wake topics, mutations. */
export function useAppData(): LoadComposedFeatures {
  return AppCompositionContext.use().loadApp;
}
