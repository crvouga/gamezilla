import { useQuery } from '@pkgs/sync-engine/client';
import {
  type ClientConfigDbRow,
  type ClientRuntimeConfig,
  DEFAULT_CLIENT_RUNTIME_CONFIG,
  parseClientConfigRows,
} from '../shared/client-config/parse-client-config';
import { clientConfigRowsQuery } from './client-config-queries';

/**
 * Typed client runtime config from local SQLite `client_config` rows.
 * No HTTP — values appear after sync hydrate (or from a prior session).
 *
 * `isLoading` is true until the local SQL watch has hydrated. An empty
 * snapshot while loading must not be treated as “all methods disabled”.
 */
export function useClientConfig(): {
  readonly config: ClientRuntimeConfig;
  readonly rows: readonly ClientConfigDbRow[];
  readonly isLoading: boolean;
} {
  const { rows, isLoading } = useQuery(clientConfigRowsQuery());
  if (rows.length === 0) {
    return { config: DEFAULT_CLIENT_RUNTIME_CONFIG, rows, isLoading };
  }
  return {
    config: parseClientConfigRows(rows),
    rows,
    isLoading,
  };
}
