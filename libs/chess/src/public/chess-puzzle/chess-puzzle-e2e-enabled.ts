/**
 * Test-only puzzle probes render in browser E2E builds (`VITE_E2E=1`, e.g. a
 * localhost stack under test) and under bun:test — never for end users.
 * `import.meta.env` is Vite's env in a browser and `process.env` under Bun.
 */
const env = import.meta.env as { VITE_E2E?: string; NODE_ENV?: string };

export const CHESS_PUZZLE_E2E_ENABLED: boolean =
  env.VITE_E2E === '1' || env.NODE_ENV === 'test';
