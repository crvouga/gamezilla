// @io-wall-ok — spec runner composition root: probes the host for a browser.
/**
 * Which real browser engine a spec runner can drive through `Bun.WebView`.
 *
 * macOS ships WebKit (WKWebView). Elsewhere `Bun.WebView` drives an installed
 * Chrome-family browser over CDP. In CI a missing browser is an error, never a
 * silent downgrade to an in-process path: the leaf would then pass without
 * having exercised a browser at all.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, win32 } from 'node:path';

export type TestEngine = 'webkit' | 'chrome';

export type TestBrowser =
  | { readonly engine: TestEngine }
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

/** Where the Chrome installer puts `chrome.exe` on Windows, per-machine then per-user. */
function windowsChromePaths(env: NodeJS.ProcessEnv): readonly string[] {
  const roots = [
    env['ProgramFiles'],
    env['ProgramFiles(x86)'],
    env['LOCALAPPDATA'],
  ].filter((root): root is string => root !== undefined && root !== '');
  return roots.map((root) =>
    win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')
  );
}

export type ChromeHost = {
  readonly env: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  readonly which: (name: string) => string | null;
  readonly exists: (path: string) => boolean;
};

const HOST: ChromeHost = {
  env: process.env,
  platform: process.platform,
  which: (name) => Bun.which(name),
  exists: existsSync,
};

/** Chrome-family executable `Bun.WebView` would spawn, or `null`. */
export function findChrome(host: ChromeHost = HOST): string | null {
  const explicit = host.env['BUN_CHROME_PATH'];
  if (explicit !== undefined && explicit !== '') return explicit;
  if (host.platform === 'win32') {
    const installed = windowsChromePaths(host.env).find(host.exists);
    if (installed !== undefined) return installed;
  }
  for (const name of CHROME_NAMES) {
    const found = host.which(name);
    if (found !== null) return found;
  }
  return standardChromePaths().find((path) => host.exists(path)) ?? null;
}

type RunVersion = (
  argv: readonly string[],
  env?: NodeJS.ProcessEnv
) => { readonly exitCode: number; readonly stdout: string };

const runVersion: RunVersion = (argv, env) => {
  const result = Bun.spawnSync([...argv], {
    stdout: 'pipe',
    stderr: 'ignore',
    ...(env === undefined ? {} : { env }),
  });
  return { exitCode: result.exitCode, stdout: result.stdout.toString() };
};

/**
 * Reads the version from `chrome.exe`'s PE version resource. On Windows
 * `chrome.exe --version` prints nothing (it is a GUI-subsystem binary and may
 * open a window), and the installer's version-named sibling directory is
 * absent from Chrome for Testing's flat `chrome-win64` layout. The path goes
 * through the environment so no quoting can turn it into PowerShell code.
 */
const WINDOWS_VERSION_COMMAND =
  '$v = (Get-Item -LiteralPath $env:CHROME_VERSION_PATH).VersionInfo; "$($v.ProductName) $($v.ProductVersion)"';

/** `Google Chrome 140.0.7339.80`-style version line, or `null`. */
export function chromeVersion(
  path: string,
  platform: NodeJS.Platform = process.platform,
  run: RunVersion = runVersion
): string | null {
  const result =
    platform === 'win32'
      ? run(
          [
            'powershell.exe',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            WINDOWS_VERSION_COMMAND,
          ],
          { ...process.env, CHROME_VERSION_PATH: path }
        )
      : run([path, '--version']);
  if (result.exitCode !== 0) return null;
  const line = result.stdout.trim();
  return line === '' ? null : line;
}

/**
 * The engine to run browser spec on: WebKit on macOS, else an installed
 * Chrome. Throws in CI (`CI` set) when no browser is available.
 */
export function resolveTestBrowser(): TestBrowser {
  if (process.platform === 'darwin') return { engine: 'webkit' };
  if (findChrome() !== null) return { engine: 'chrome' };
  const reason =
    'no Chrome-family browser found (set BUN_CHROME_PATH or install google-chrome)';
  if (process.env['CI'] !== undefined && process.env['CI'] !== '') {
    throw new Error(`spec: ${reason}; CI must run browser tests in a browser`);
  }
  return { engine: null, reason };
}
