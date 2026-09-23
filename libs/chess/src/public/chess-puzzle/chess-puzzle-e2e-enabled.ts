/**
 * E2E probes render in `VITE_E2E=1` web bundles and under bun:test.
 * `import.meta.env` is Vite's build-time env in the browser and Bun's
 * `process.env` in tests — a bare `process` check never fires in a browser.
 */
const env = import.meta.env as { VITE_E2E?: string; NODE_ENV?: string };

export const CHESS_PUZZLE_E2E_ENABLED: boolean =
  env.VITE_E2E === '1' || env.NODE_ENV === 'test';
