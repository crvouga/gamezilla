/**
 * In-file opt-in for Io CI gates — no path allowlists.
 *
 * Composition roots / wall adapters mark themselves with `@io-wall-ok`:
 *
 *   // @io-wall-ok
 *   // or inside a block comment: @io-wall-ok …
 *
 * For resolve/bare gates, the pragma only counts on entry-shaped paths
 * (see {@link isIoCompositionEntryPath}).
 */

const PRAGMA_LINE = /^\s*(?:\/\/|\*|\/\*\*?)\s*@io-wall-ok\b|^\s*@io-wall-ok\b/;

/** True when the file text contains a `@io-wall-ok` pragma comment line. */
export function fileHasIoWallOkPragma(text: string): boolean {
  for (const line of text.split('\n')) {
    if (PRAGMA_LINE.test(line)) return true;
  }
  return false;
}

/** Basenames that are process / wall-adapter composition roots. */
const ENTRY_BASENAMES = new Set([
  'wall-io.ts',
  'sim-io.ts',
  'wall.ts',
  'wall-node-fs.ts',
  'wall-os-fs.ts',
  'wall-expo-fs.ts',
  'wall-path-exists.ts',
  'build-web.ts',
  'repo-tree-store.ts',
  'global.ts',
  'cli-io.ts',
  'app-io-provider.tsx',
  'polyfill-entry.ts',
  'create-app.ts',
  'api.ts',
  'room.ts',
  'migrate.ts',
  'migrate-cli.ts',
  'seed.ts',
  'dev.ts',
  'summarize-cli.ts',
  'default-crash-handler.ts',
  'export-chess-puzzles-load.ts',
  'serve-harness.ts',
  'example-root.tsx',
  'impl-pg-mem.ts',
  'app.tsx',
  'boot-playground.ts',
  'compose-sub-apps.tsx',
]);

/**
 * Structural entry shape — scripts/, known entry basenames, explorer examples,
 * and the clock barrel that re-exports wall adapters.
 */
export function isIoCompositionEntryPath(rel: string): boolean {
  if (rel.includes('/scripts/')) return true;
  // Infra CLI is a process composition root (secrets seed, deploy, GHA).
  if (rel.startsWith('libs/infra/src/cli/')) return true;
  // Expo crypto wall polyfill (RNG/UUID for RN).
  if (rel === 'pkgs/polyfill/src/crypto.ts') return true;
  const base = rel.split('/').pop() ?? '';
  if (ENTRY_BASENAMES.has(base)) return true;
  // SharedWorker process roots (separate JS realm; still require `@io-wall-ok`).
  if (
    base.endsWith('-shared-worker.ts') ||
    base.endsWith('-shared-worker.js')
  ) {
    return true;
  }
  if (base.endsWith('-boot.js') || base.endsWith('-boot.ts')) {
    return true;
  }
  if (base.endsWith('.example.ts') || base.endsWith('.example.tsx')) {
    return true;
  }
  if (rel === 'pkgs/clock/src/index.ts') {
    return true;
  }
  // SQL client e2e harness entries.
  if (
    rel.endsWith('/e2e/harness/tab-app.ts') ||
    rel.endsWith('/e2e/harness/harness-client.ts')
  ) {
    return true;
  }
  return false;
}

/** Pragma present and path is a true composition / wall-adapter entry. */
export function fileAllowsWallConstruction(rel: string, text: string): boolean {
  return fileHasIoWallOkPragma(text) && isIoCompositionEntryPath(rel);
}
