export class GrafanaCloudApiError extends Error {
  readonly status: number;
  constructor(label: string, status: number, body: string) {
    super(`Grafana Cloud ${label} failed: HTTP ${String(status)} ${body}`);
    this.name = 'GrafanaCloudApiError';
    this.status = status;
  }
}
