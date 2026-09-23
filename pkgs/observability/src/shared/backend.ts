export type ObservabilityBackend = 'noop' | 'local-file' | 'logger';

export const DEFAULT_COLLECTOR_URL = 'http://127.0.0.1:8799';

export function parseObservabilityBackend(
  raw: string | undefined | null
): ObservabilityBackend | null {
  const v = raw?.trim().toLowerCase() ?? '';
  if (v === '') return null;
  if (v === 'noop') return 'noop';
  if (v === 'local-file') return 'local-file';
  if (v === 'logger') return 'logger';
  return 'noop';
}

export function resolveObservabilityBackend(
  envBackend: string | undefined | null
): ObservabilityBackend {
  return parseObservabilityBackend(envBackend) ?? 'noop';
}
