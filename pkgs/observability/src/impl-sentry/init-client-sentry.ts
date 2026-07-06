import * as Sentry from '@sentry/react-native';

declare const __DEV__: boolean | undefined;

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env['NODE_ENV'] !== 'production';
}

function trimEnv(key: string): string | null {
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSentryBackendEnabled(): boolean {
  return (
    trimEnv('EXPO_PUBLIC_OBSERVABILITY_BACKEND')?.toLowerCase() === 'sentry'
  );
}

export function initClientSentry(): boolean {
  if (!isSentryBackendEnabled()) return false;

  const dsn = trimEnv('EXPO_PUBLIC_SENTRY_DSN');
  if (dsn === null) return false;

  Sentry.init({
    dsn,
    debug: isDevBuild(),
    enableLogs: true,
    environment:
      trimEnv('EXPO_PUBLIC_SENTRY_ENV') ??
      (isDevBuild() ? 'development' : 'production'),
    tracesSampleRate: isDevBuild() ? 1.0 : 0.2,
    integrations(integrations) {
      integrations.push(Sentry.expoRouterIntegration());
      return integrations;
    },
  });
  return true;
}

export function isClientSentryEnabled(): boolean {
  return isSentryBackendEnabled() && trimEnv('EXPO_PUBLIC_SENTRY_DSN') !== null;
}
