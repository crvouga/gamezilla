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
  'wall-client-env.ts',
  'wall-room-server-env.ts',
  'real-time-runtime.ts',
  'real-time-scheduler.ts',
  'wall-node-fs.ts',
  'wall-os-fs.ts',
  'wall-browser-fs.ts',
  'wall-web-device.ts',
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
  'app.tsx',
  'boot-product-simulator.ts',
  'root-app.tsx',
  'main.tsx',
]);

/** Strip RN platform suffixes so `wall.web.ts` matches `wall.ts`. */
function normalizeEntryBasename(base: string): string {
  return base.replace(
    /\.(web|native|ios|android|macos|windows)\.(ts|tsx|js|jsx)$/u,
    '.$2'
  );
}

/**
 * Structural entry shape — scripts/, known entry basenames, explorer examples,
 * and the clock barrel that re-exports wall adapters.
 */
export function isIoCompositionEntryPath(rel: string): boolean {
  if (rel.includes('/scripts/')) return true;
  // Infra CLI is a process composition root (secrets seed, deploy, GHA).
  if (rel.startsWith('libs/secrets/src/shared/')) return true;
  // Browser crypto wall polyfill (RNG/UUID for web).
  if (rel === 'pkgs/polyfill/src/crypto.ts') return true;
  const base = rel.split('/').pop() ?? '';
  if (
    ENTRY_BASENAMES.has(base) ||
    ENTRY_BASENAMES.has(normalizeEntryBasename(base))
  ) {
    return true;
  }
  // Worker process roots (separate JS realm; still require `@io-wall-ok`).
  if (
    base.endsWith('-shared-worker.ts') ||
    base.endsWith('-shared-worker.js') ||
    base.endsWith('-worker-entry.ts')
  ) {
    return true;
  }
  // Browser worker spawners (`new Worker(new URL(..., import.meta.url))`).
  if (base.startsWith('spawn-') && base.endsWith('-worker.ts')) {
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
  // Browser iframe entry for the web SQLite OPFS owner (bundled sql-host page).
  if (base === 'sql-host-entry.ts') {
    return true;
  }
  // Bun.WebView e2e host + ui-testing bun-webview wall driver.
  if (rel.endsWith('/e2e/webview.ts')) {
    return true;
  }
  if (base === 'bun-webview-driver-node.ts') {
    return true;
  }
  return false;
}

/** Pragma present and path is a true composition / wall-adapter entry. */
export function fileAllowsWallConstruction(rel: string, text: string): boolean {
  return fileHasIoWallOkPragma(text) && isIoCompositionEntryPath(rel);
}
