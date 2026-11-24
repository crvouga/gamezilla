/** @jsxImportSource @solidjs/web */
/**
 * Local sync umbrella: identity-scoped SQLite boot (`shell/sync/sync-engine-boot.tsx`).
 *
 * Profile / device / wipe-local bridges mount inside `sync-engine-ready-tree.tsx`
 * so `@pkgs/sync-engine/solid` stays off the shell entry chunk.
 */

import type { JSX } from '@solidjs/web';
import { SyncEngineBoot } from './sync-engine-boot';

export function AppLocalDatabaseProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return <SyncEngineBoot>{props.children}</SyncEngineBoot>;
}
