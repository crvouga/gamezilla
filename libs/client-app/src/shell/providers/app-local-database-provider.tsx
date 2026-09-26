/** @jsxImportSource solid-js */
/**
 * Local sync umbrella: identity-scoped SQLite boot (`shell/sync/sync-engine-boot.tsx`).
 *
 * Profile / device / wipe-local bridges mount inside `sync-engine-ready-tree.tsx`
 * so `@pkgs/sync-engine/solid` stays off the shell entry chunk.
 */

import type { JSX } from 'solid-js';
import { SyncEngineBoot } from '../sync/sync-engine-boot';

export function AppLocalDatabaseProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return <SyncEngineBoot>{props.children}</SyncEngineBoot>;
}
