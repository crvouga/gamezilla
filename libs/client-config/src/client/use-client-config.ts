import { useQuery } from '@pkgs/sync-engine/client';
import {
  type ClientConfigDbRow,
  type ClientRuntimeConfig,
  DEFAULT_CLIENT_RUNTIME_CONFIG,
  parseClientConfigRows,
} from '../shared/parse-client-config';
import { clientConfigRowsQuery } from './client-config-queries';

/**
 * Typed client runtime config from local SQLite `client_config` rows.
 * No HTTP — values appear after sync hydrate (or from a prior session).
 */
export function useClientConfig(): {
  readonly config: ClientRuntimeConfig;
  readonly rows: readonly ClientConfigDbRow[];
} {
  const { rows } = useQuery(clientConfigRowsQuery());
  if (rows.length === 0) {
    return { config: DEFAULT_CLIENT_RUNTIME_CONFIG, rows };
  }
  return {
    config: parseClientConfigRows(rows),
    rows,
  };
}
