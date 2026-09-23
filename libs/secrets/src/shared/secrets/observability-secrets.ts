import { Secret } from './secret';

const BACKEND_VALUES = new Set(['logger', 'local-file', 'noop', '']);

const DEFAULT_BACKEND = 'noop';

export const OBSERVABILITY_BACKEND = new Secret({
  name: 'OBSERVABILITY_BACKEND',
  hint: 'API observability backend: logger | noop | local-file',
  optional: true,
  pushToApiWorker: true,
  validate: async (input) => {
    const v = input.secretValue.trim().toLowerCase();
    if (!BACKEND_VALUES.has(v) && v.length > 0) {
      throw new Error(
        `OBSERVABILITY_BACKEND must be logger|noop|local-file (got ${JSON.stringify(v)})`
      );
    }
  },
  seed: async () => DEFAULT_BACKEND,
});
