/**
 * Test-only puzzle probes render in browser test builds (`VITE_TEST_HOOKS=1`,
 * e.g. a localhost stack under test) and under bun:test — never for end
 * users. `import.meta.env` is Vite's env in a browser and `process.env`
 * under Bun.
 */
const env = import.meta.env as { VITE_TEST_HOOKS?: string; NODE_ENV?: string };

export const PUZZLE_TEST_ENABLED: boolean =
  env.VITE_TEST_HOOKS === '1' || env.NODE_ENV === 'test';
