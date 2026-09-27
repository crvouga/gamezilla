// @io-wall-ok — e2e runner composition root: probes the host for a browser.
/**
 * Which real browser engine an e2e runner can drive through `Bun.WebView`.
 *
 * macOS ships WebKit (WKWebView). Elsewhere `Bun.WebView` drives an installed
 * Chrome-family browser over CDP. In CI a missing browser is an error, never a
 * silent downgrade to an in-process path: the leaf would then pass without
 * having exercised a browser at all.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type E2eEngine = 'webkit' | 'chrome';

export type E2eBrowser =
  | { readonly engine: E2eEngine }
  | { readonly engine: null; readonly reason: string };

/** Same executable names `Bun.WebView` searches on `$PATH`. */
const CHROME_NAMES = [
  'google-chrome-stable',
  'google-chrome',
  'chromium-browser',
  'chromium',
  'brave-browser',
  'microsoft-edge',
  'chrome',
] as const;

/** Standard install locations `Bun.WebView` also checks (off `$PATH`). */
function standardChromePaths(): readonly string[] {
  const mac = 'Google Chrome.app/Contents/MacOS/Google Chrome';
  return [
    join('/Applications', mac),
    join(homedir(), 'Applications', mac),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
}

/** Chrome-family executable `Bun.WebView` would spawn, or `null`. */
export function findChrome(): string | null {
  const explicit = process.env['BUN_CHROME_PATH'];
  if (explicit !== undefined && explicit !== '') return explicit;
  for (const name of CHROME_NAMES) {
    const found = Bun.which(name);
    if (found !== null) return found;
  }
  return standardChromePaths().find((path) => existsSync(path)) ?? null;
}

/** `Google Chrome 140.0.7339.80`-style version line, or `null`. */
export function chromeVersion(path: string): string | null {
  const result = Bun.spawnSync([path, '--version'], {
    stdout: 'pipe',
    stderr: 'ignore',
  });
  if (result.exitCode !== 0) return null;
  const line = result.stdout.toString().trim();
  return line === '' ? null : line;
}

/**
 * The engine to run browser e2e on: WebKit on macOS, else an installed
 * Chrome. Throws in CI (`CI` set) when no browser is available.
 */
export function resolveE2eBrowser(): E2eBrowser {
  if (process.platform === 'darwin') return { engine: 'webkit' };
  if (findChrome() !== null) return { engine: 'chrome' };
  const reason =
    'no Chrome-family browser found (set BUN_CHROME_PATH or install google-chrome)';
  if (process.env['CI'] !== undefined && process.env['CI'] !== '') {
    throw new Error(`e2e: ${reason}; CI must run browser tests in a browser`);
  }
  return { engine: null, reason };
}
