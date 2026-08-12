declare const __DEV__: boolean | undefined;

function loadReactNativeSentry(): typeof import('@sentry/react-native') {
  // Lazy: sims/Jest must not load @sentry/react-native (module-level setInterval).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@sentry/react-native') as typeof import('@sentry/react-native');
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env['NODE_ENV'] !== 'production';
}

export type InitClientSentryArgs = {
  readonly backend: string | null | undefined;
  readonly dsn: string | null | undefined;
  readonly environment?: string | null | undefined;
};

function trimOrNull(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSentryBackend(backend: string | null | undefined): boolean {
  return trimOrNull(backend)?.toLowerCase() === 'sentry';
}

let initialized = false;

/**
 * Initialize Sentry from synced client_config (or explicit args).
 * No-ops when backend is not `sentry` or DSN is missing.
 */
export function initClientSentry(args?: InitClientSentryArgs): boolean {
  if (initialized) return true;
  const backend = args?.backend;
  const dsn = trimOrNull(args?.dsn);
  if (!isSentryBackend(backend) || dsn === null) return false;

  const Sentry = loadReactNativeSentry();
  Sentry.init({
    dsn,
    debug: isDevBuild(),
    enableLogs: true,
    environment:
      trimOrNull(args?.environment) ??
      (isDevBuild() ? 'development' : 'production'),
    tracesSampleRate: isDevBuild() ? 1.0 : 0.2,
    integrations(integrations) {
      integrations.push(Sentry.expoRouterIntegration());
      return integrations;
    },
  });
  initialized = true;
  return true;
}

export function isClientSentryEnabled(args?: InitClientSentryArgs): boolean {
  if (args !== undefined) {
    return isSentryBackend(args.backend) && trimOrNull(args.dsn) !== null;
  }
  return initialized;
}
