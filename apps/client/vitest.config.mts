// @io-wall-ok — test-tool composition root
import { defineSolidVitestConfig } from '@pkgs/vitest-solid/config';

/**
 * Component tests (`*.test.tsx`) run under Vitest + happy-dom.
 * Plain `*.test.ts` unit tests stay on `bun test`.
 */
export default defineSolidVitestConfig({
  root: import.meta.dirname,
  include: ['src/**/*.test.tsx'],
  overrides: {
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        // React-era test; removed with the RN tree.
        'src/providers/local-database/use-sync-engine-boot-state.test.tsx',
      ],
    },
  },
});
