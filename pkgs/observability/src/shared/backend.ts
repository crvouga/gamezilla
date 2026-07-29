export type ObservabilityBackend = 'noop' | 'local-file' | 'logger' | 'sentry';

export const DEFAULT_COLLECTOR_URL = 'http://127.0.0.1:8799';

export function parseObservabilityBackend(
  raw: string | undefined | null
): ObservabilityBackend | null {
  const v = raw?.trim().toLowerCase() ?? '';
  if (v === '') return null;
  if (v === 'noop' || v === 'none') return 'noop';
  if (v === 'local-file') return 'local-file';
  if (v === 'logger' || v === 'console') return 'logger';
  if (v === 'sentry') return 'sentry';
  return 'noop';
}

export function resolveObservabilityBackend(args: {
  readonly envBackend: string | undefined | null;
  readonly forceNoop?: boolean;
  readonly isProduction?: boolean;
}): ObservabilityBackend {
  if (args.forceNoop === true) return 'noop';
  const explicit = parseObservabilityBackend(args.envBackend);
  if (explicit !== null) return explicit;
  // Default quiet until Sentry (or another backend) is intentionally enabled.
  return 'noop';
}
