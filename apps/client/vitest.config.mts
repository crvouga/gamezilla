// @io-wall-ok — test-tool composition root
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.mts';

/**
 * Component tests (`*.test.tsx`) run under Vitest + happy-dom.
 * Plain `*.test.ts` unit tests stay on `bun test`.
 */
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    resolve: {
      conditions: ['development', 'browser'],
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.tsx'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        // React-era test; removed with the RN tree.
        'src/providers/local-database/use-sync-engine-boot-state.test.tsx',
      ],
      setupFiles: ['./tests/support/vitest-setup.ts'],
      passWithNoTests: false,
    },
  })
);
