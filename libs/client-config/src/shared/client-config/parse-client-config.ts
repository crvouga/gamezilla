import { ClientConfigKey } from './client-config-keys';

export type ClientConfigDbRow = {
  readonly id: string;
  readonly value: unknown;
  readonly deleted_at: string | null;
};

export type ClientRuntimeConfig = {
  readonly google_enabled: boolean;
  readonly google_web_client_id: string | null;
  readonly dev_oauth_enabled: boolean;
  readonly billing_enabled: boolean;
  readonly tts_enabled: boolean;
  readonly llm_enabled: boolean;
  readonly emqx_wss_url: string | null;
};

export const DEFAULT_CLIENT_RUNTIME_CONFIG: ClientRuntimeConfig = {
  google_enabled: false,
  google_web_client_id: null,
  dev_oauth_enabled: false,
  billing_enabled: false,
  tts_enabled: false,
  llm_enabled: false,
  emqx_wss_url: null,
};

/** SQLite stores booleans as 0/1; Postgres returns real booleans. */
function readBoolean(raw: unknown): boolean {
  return (
    raw === true || raw === 1 || raw === '1' || raw === 't' || raw === 'true'
  );
}

function isLiveRow(row: ClientConfigDbRow): boolean {
  // Some drivers omit NULL columns as `undefined` instead of `null`.
  // Client queries already filter `deleted_at IS NULL`; treat nullish as live.
  return row.deleted_at == null;
}

function coerceJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === 'null') return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function liveValue(
  byId: Map<string, ClientConfigDbRow>,
  id: string
): unknown | undefined {
  const row = byId.get(id);
  if (row === undefined || !isLiveRow(row)) return undefined;
  return coerceJsonValue(row.value);
}

function parseBool(raw: unknown | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return readBoolean(raw);
}

function parseNullableString(raw: unknown | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse synced `client_config` rows into a typed runtime view.
 * Unknown / invalid rows are ignored; missing keys default to disabled / null.
 */
export function parseClientConfigRows(
  rows: readonly ClientConfigDbRow[]
): ClientRuntimeConfig {
  const byId = new Map<string, ClientConfigDbRow>();
  for (const row of rows) {
    if (typeof row.id !== 'string' || row.id.length === 0) continue;
    byId.set(row.id, row);
  }

  return {
    google_enabled: parseBool(
      liveValue(byId, ClientConfigKey.googleEnabled),
      false
    ),
    google_web_client_id: parseNullableString(
      liveValue(byId, ClientConfigKey.googleWebClientId)
    ),
    dev_oauth_enabled: parseBool(
      liveValue(byId, ClientConfigKey.devOauthEnabled),
      false
    ),
    billing_enabled: parseBool(
      liveValue(byId, ClientConfigKey.billingEnabled),
      false
    ),
    tts_enabled: parseBool(liveValue(byId, ClientConfigKey.ttsEnabled), false),
    llm_enabled: parseBool(liveValue(byId, ClientConfigKey.llmEnabled), false),
    emqx_wss_url: parseNullableString(
      liveValue(byId, ClientConfigKey.emqxWssUrl)
    ),
  };
}
