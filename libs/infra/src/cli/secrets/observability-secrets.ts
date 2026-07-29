import { Secret, requireNonEmpty } from './secret';

const BACKEND_VALUES = new Set(['sentry', 'console', 'logger', 'noop', 'none', '']);

/** Quiet until Sentry is intentionally turned on (`sentry` + DSN). */
const DEFAULT_BACKEND = 'noop';

export const OBSERVABILITY_BACKEND = new Secret({
  name: 'OBSERVABILITY_BACKEND',
  hint: 'API observability backend: sentry | console | noop',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    const v = input.secretValue.trim().toLowerCase();
    if (!BACKEND_VALUES.has(v) && v.length > 0) {
      throw new Error(
        `OBSERVABILITY_BACKEND must be sentry|console|noop (got ${JSON.stringify(v)})`
      );
    }
  },
  seed: async () => DEFAULT_BACKEND,
});

export const SENTRY_DSN = new Secret({
  name: 'SENTRY_DSN',
  hint: 'Sentry DSN for the API worker',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'SENTRY_DSN');
    if (!input.secretValue.trim().startsWith('https://')) {
      throw new Error('SENTRY_DSN must be an https URL');
    }
  },
});

export const EXPO_PUBLIC_OBSERVABILITY_BACKEND = new Secret({
  name: 'EXPO_PUBLIC_OBSERVABILITY_BACKEND',
  hint: 'Client observability backend: sentry | console | noop',
  optional: true,
  validate: async (input) => {
    const v = input.secretValue.trim().toLowerCase();
    if (!BACKEND_VALUES.has(v) && v.length > 0) {
      throw new Error(
        `EXPO_PUBLIC_OBSERVABILITY_BACKEND must be sentry|console|noop (got ${JSON.stringify(v)})`
      );
    }
  },
  seed: async () => DEFAULT_BACKEND,
});

export const EXPO_PUBLIC_SENTRY_DSN = new Secret({
  name: 'EXPO_PUBLIC_SENTRY_DSN',
  hint: 'Sentry DSN for the Expo client',
  optional: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'EXPO_PUBLIC_SENTRY_DSN');
    if (!input.secretValue.trim().startsWith('https://')) {
      throw new Error('EXPO_PUBLIC_SENTRY_DSN must be an https URL');
    }
  },
});
