import * as Sentry from '@sentry/react-native';

function trimEnv(key: string): string | null {
  const raw = process.env[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const dsn = trimEnv('EXPO_PUBLIC_SENTRY_DSN');

if (dsn !== null) {
  Sentry.init({
    dsn,
    debug: __DEV__,
    environment: trimEnv('EXPO_PUBLIC_SENTRY_ENV') ?? (__DEV__ ? 'development' : 'production'),
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    integrations(integrations) {
      integrations.push(Sentry.expoRouterIntegration());
      return integrations;
    },
  });
} else if (__DEV__) {
  console.warn(
    '[sentry] EXPO_PUBLIC_SENTRY_DSN is missing; error reporting is disabled. ' +
      'Add the DSN from Sentry project settings to Vault or .env.local.'
  );
}
