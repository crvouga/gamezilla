/** Infisical / Worker secret keys for Grafana Cloud trace ingest + query. */
export const ObservabilitySecretName = {
  /** Bootstrap Cloud Access Policy token; provision-only, never on a Worker. */
  grafanaCloudApiToken: 'GRAFANA_CLOUD_API_TOKEN',
  /** Exact OTLP/HTTP traces endpoint (Grafana OTLP gateway `/otlp/v1/traces`). */
  collectorUrl: 'OBSERVABILITY_COLLECTOR_URL',
  /** Basic-auth user for ingest (Grafana Cloud stack id). */
  collectorUser: 'OBSERVABILITY_COLLECTOR_USER',
  /** Write-only `traces:write` token. */
  collectorToken: 'OBSERVABILITY_COLLECTOR_TOKEN',
  /** Tempo query origin for `bun obs --source prod`. */
  tempoUrl: 'OBS_TEMPO_URL',
  /** Tempo Basic-auth user (Grafana Cloud Tempo instance id). */
  tempoUser: 'OBS_TEMPO_USER',
  /** Read-only `traces:read` token. */
  tempoToken: 'OBS_TEMPO_TOKEN',
  /** SELECT-only Postgres URL for resolving a person's name. Never the owner URL. */
  readonlyDatabaseUrl: 'OBS_READONLY_DATABASE_URL',
} as const;

export type ObservabilitySecretKey =
  (typeof ObservabilitySecretName)[keyof typeof ObservabilitySecretName];
