/**
 * OTLP ingest `Authorization` value. A user switches to Basic auth (Grafana
 * Cloud: stack instance id + access-policy token); a bare token is Bearer
 * (local / CI Collector). Returns `undefined` when no token is configured.
 */
export function otlpAuthorization(credentials: {
  readonly user?: string | null | undefined;
  readonly token?: string | null | undefined;
}): string | undefined {
  const token = credentials.token?.trim() ?? '';
  if (token.length === 0) return undefined;
  const user = credentials.user?.trim() ?? '';
  if (user.length === 0) return `Bearer ${token}`;
  return `Basic ${btoa(`${user}:${token}`)}`;
}
