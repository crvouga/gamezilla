/** Infisical / Worker secret keys for Grafana Cloud trace ingest + query. */
export const ObservabilitySecretName = {
  /** Bootstrap Cloud Access Policy token; provision-only, never on a Worker. */
  grafanaCloudApiToken: 'GRAFANA_CLOUD_API_TOKEN',
  /** Exact OTLP/HTTP traces endpoint (Grafana OTLP gateway `/otlp/v1/traces`). */
  collectorUrl: 'OBSERVABILITY_COLLECTOR_URL',
  logsUrl: 'OBSERVABILITY_LOGS_URL',
  metricsUrl: 'OBSERVABILITY_METRICS_URL',
  /** Basic-auth user for ingest (Grafana Cloud stack id). */
  collectorUser: 'OBSERVABILITY_COLLECTOR_USER',
  /** Write-only `traces:write` token. */
  collectorToken: 'OBSERVABILITY_COLLECTOR_TOKEN',
  /** Tempo query origin for `bun obs --source prod`. */
  tempoUrl: 'OBS_TEMPO_URL',
  /** Tempo Basic-auth user (Grafana Cloud Tempo instance id). */
  tempoUser: 'OBS_TEMPO_USER',
  /**
   * The stack's read-only token: `traces:read`, `logs:read` and `metrics:read`.
   * It authenticates Tempo, Loki and Mimir; only the Basic-auth user differs.
   */
  tempoToken: 'OBS_TEMPO_TOKEN',
  /** Loki query origin (business events and diagnostics). */
  lokiUrl: 'OBS_LOKI_URL',
  /** Loki Basic-auth user (Grafana Cloud Loki instance id). */
  lokiUser: 'OBS_LOKI_USER',
  /** Mimir Prometheus-API origin, ending `/api/prom` (SLO and alert queries). */
  prometheusUrl: 'OBS_PROMETHEUS_URL',
  /** Mimir Basic-auth user (Grafana Cloud Prometheus instance id). */
  prometheusUser: 'OBS_PROMETHEUS_USER',
  /** SELECT-only Postgres URL for resolving a person's name. Never the owner URL. */
  readonlyDatabaseUrl: 'OBS_READONLY_DATABASE_URL',
} as const;

export type ObservabilitySecretKey =
  (typeof ObservabilitySecretName)[keyof typeof ObservabilitySecretName];
