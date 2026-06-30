export type ObservabilityBackend = 'noop' | 'local-file';

export const DEFAULT_COLLECTOR_URL = 'http://127.0.0.1:8799';

export function parseObservabilityBackend(
  raw: string | undefined | null
): ObservabilityBackend {
  const v = raw?.trim().toLowerCase() ?? '';
  if (v === 'local-file') return 'local-file';
  return 'noop';
}

export function resolveObservabilityBackend(args: {
  readonly envBackend: string | undefined | null;
  readonly forceNoop?: boolean;
}): ObservabilityBackend {
  if (args.forceNoop === true) return 'noop';
  return parseObservabilityBackend(args.envBackend);
}
