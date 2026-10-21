import type {
  ClientConfigDbRow,
  ClientRuntimeConfig,
} from '@libs/app-config-shared-ts/parse-client-config';
import {
  DEFAULT_CLIENT_RUNTIME_CONFIG,
  parseClientConfigRows,
} from '@libs/app-config-shared-ts/parse-client-config';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { clientConfigRowsQuery } from './client-config-queries';

/**
 * Typed client runtime config from local SQLite `client_config` rows.
 * No HTTP — values appear after sync hydrate (or from a prior session).
 *
 * `isLoading` is true until the local SQL watch has hydrated. An empty
 * snapshot while loading must not be treated as “all methods disabled”.
 */
export function useClientConfig(): {
  readonly config: Accessor<ClientRuntimeConfig>;
  readonly rows: Accessor<readonly ClientConfigDbRow[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const query = createQuery(clientConfigRowsQuery);
  const config = createMemo(() =>
    query.rows().length === 0
      ? DEFAULT_CLIENT_RUNTIME_CONFIG
      : parseClientConfigRows(query.rows())
  );
  return {
    config,
    rows: query.rows,
    isLoading: query.isLoading,
  };
}
