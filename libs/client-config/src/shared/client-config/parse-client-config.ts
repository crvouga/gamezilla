import {
  DEFAULT_BILLING_GRACE_PERIOD_MS,
  DEFAULT_LIMITS_SPEC,
  type LimitsSpec,
  type TierLimits,
} from '@pkgs/entitlements';

import {
  ClientConfigKey,
  type ObservabilityBackendName,
} from './client-config-keys';

export type ClientConfigDbRow = {
  readonly id: string;
  readonly value: unknown;
  readonly deleted_at: string | null;
};

export type ClientRuntimeConfig = {
  readonly google_enabled: boolean;
  readonly google_web_client_id: string | null;
  readonly billing_enabled: boolean;
  readonly tts_enabled: boolean;
  readonly llm_enabled: boolean;
  readonly emqx_wss_url: string | null;
  readonly observability_backend: ObservabilityBackendName;
  readonly limits_spec: LimitsSpec;
  readonly billing_grace_period_ms: number;
};

export const DEFAULT_CLIENT_RUNTIME_CONFIG: ClientRuntimeConfig = {
  google_enabled: false,
  google_web_client_id: null,
  billing_enabled: false,
  tts_enabled: false,
  llm_enabled: false,
  emqx_wss_url: null,
  observability_backend: 'noop',
  limits_spec: DEFAULT_LIMITS_SPEC,
  billing_grace_period_ms: DEFAULT_BILLING_GRACE_PERIOD_MS,
};

const OBSERVABILITY_BACKENDS = new Set<string>(['noop', 'console']);

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

function parseObservabilityBackend(
  raw: unknown | undefined
): ObservabilityBackendName {
  if (typeof raw !== 'string') return 'noop';
  if (!OBSERVABILITY_BACKENDS.has(raw)) return 'noop';
  return raw as ObservabilityBackendName;
}

function isTierLimits(value: unknown): value is TierLimits {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const counted = (raw: unknown): boolean =>
    raw === null || (typeof raw === 'number' && Number.isFinite(raw));
  return (
    counted(record['puzzlesPerDay']) &&
    counted(record['maxHostedSpaces']) &&
    typeof record['canHost'] === 'boolean' &&
    typeof record['canJoin'] === 'boolean' &&
    typeof record['canWatch'] === 'boolean' &&
    typeof record['canUseFriends'] === 'boolean' &&
    typeof record['canCustomizeFeed'] === 'boolean'
  );
}

/** Config-driven policy; anything malformed falls back to the shipped spec. */
function parseLimitsSpec(raw: unknown): LimitsSpec {
  if (raw === null || typeof raw !== 'object') return DEFAULT_LIMITS_SPEC;
  const record = raw as Record<string, unknown>;
  const guest = record['guest'];
  const free = record['free'];
  const paid = record['paid'];
  if (!isTierLimits(guest) || !isTierLimits(free) || !isTierLimits(paid)) {
    return DEFAULT_LIMITS_SPEC;
  }
  return { guest, free, paid };
}

function parseGracePeriodMs(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_BILLING_GRACE_PERIOD_MS;
}

/**
 * Parse synced `client_config` rows into a typed runtime view.
 * Unknown / invalid rows are ignored; missing keys default to disabled / null / noop.
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
    billing_enabled: parseBool(
      liveValue(byId, ClientConfigKey.billingEnabled),
      false
    ),
    tts_enabled: parseBool(liveValue(byId, ClientConfigKey.ttsEnabled), false),
    llm_enabled: parseBool(liveValue(byId, ClientConfigKey.llmEnabled), false),
    emqx_wss_url: parseNullableString(
      liveValue(byId, ClientConfigKey.emqxWssUrl)
    ),
    observability_backend: parseObservabilityBackend(
      liveValue(byId, ClientConfigKey.observabilityBackend)
    ),
    limits_spec: parseLimitsSpec(liveValue(byId, ClientConfigKey.limitsSpec)),
    billing_grace_period_ms: parseGracePeriodMs(
      liveValue(byId, ClientConfigKey.billingGracePeriodMs)
    ),
  };
}
