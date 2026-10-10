/** @jsxImportSource solid-js */
/**
 * The sub set this client was composed from.
 *
 * `createClient(env, { subs, loadApp })` publishes both halves here:
 * `subs` is what the UI is made of (routes, tabs, providers), `loadApp`
 * resolves what sync is made of (schema, queries, wake topics, mutations).
 * The chrome can ask what tabs exist and the sync boot can ask what schema to
 * open without either of them naming a sub — which is why a shell running
 * one bounded context and a shell running the flat shipped list are the same
 * code.
 *
 * The sync half is behind a thunk because it is not needed until the local
 * database opens, which is after first paint by design. Resolving it eagerly
 * would put every sub's manifest on the entry chunk — the low-end Android
 * critical-path gate catches exactly that.
 */

import type { ComposedSubClients } from '@libs/sub-client/compose-client';
import type { ComposedSubs } from '@libs/sub-shared/compose';
import { defineContext } from '@pkgs/solid-context-client/define-context';

export type LoadComposedSubs = () => Promise<ComposedSubs>;

export type AppComposition = {
  readonly clients: ComposedSubClients;
  readonly loadApp: LoadComposedSubs;
};

const AppCompositionContext = defineContext<AppComposition>('AppComposition');

export const AppCompositionProvider = AppCompositionContext.Provider;

/** The UI half: routes, tabs, docks, providers. */
export function useAppSubs(): ComposedSubClients {
  return AppCompositionContext.use().clients;
}

/** The sync half: schema, queries, session queries, wake topics, mutations. */
export function useAppData(): LoadComposedSubs {
  return AppCompositionContext.use().loadApp;
}
