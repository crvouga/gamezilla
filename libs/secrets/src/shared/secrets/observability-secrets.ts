import { Secret } from './secret';

const BACKEND_VALUES = new Set([
  'console',
  'logger',
  'local-file',
  'noop',
  'none',
  '',
]);

const DEFAULT_BACKEND = 'noop';

export const OBSERVABILITY_BACKEND = new Secret({
  name: 'OBSERVABILITY_BACKEND',
  hint: 'API observability backend: console | noop | local-file',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    const v = input.secretValue.trim().toLowerCase();
    if (!BACKEND_VALUES.has(v) && v.length > 0) {
      throw new Error(
        `OBSERVABILITY_BACKEND must be console|noop|local-file (got ${JSON.stringify(v)})`
      );
    }
  },
  seed: async () => DEFAULT_BACKEND,
});

export const VITE_OBSERVABILITY_BACKEND = new Secret({
  name: 'VITE_OBSERVABILITY_BACKEND',
  hint: 'Client observability backend: console | noop',
  optional: true,
  validate: async (input) => {
    const v = input.secretValue.trim().toLowerCase();
    if (!BACKEND_VALUES.has(v) && v.length > 0) {
      throw new Error(
        `VITE_OBSERVABILITY_BACKEND must be console|noop (got ${JSON.stringify(v)})`
      );
    }
  },
  seed: async () => DEFAULT_BACKEND,
});
