// @io-wall-ok — start the OAuth harness then run bun:test.
// The harness drives a real browser engine through Bun.WebView: WebKit on
// macOS, headless Chrome on Linux (CI). Only a local machine with no browser
// exercises the same OAuth contract through the in-process path instead.

import { killListenersOnPort } from '@pkgs/os/kill-port';
import { resolveE2eBrowser } from '@pkgs/ui-testing-bun-webview/e2e-browser';
import { waitForHttp } from './webview';

const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const HERE = import.meta.dir;

const browser = resolveE2eBrowser();

if (browser.engine !== null) {
  // Full Bun.WebView e2e path with real browser automation.
  killListenersOnPort(PORT);

  // The harness imports the simulated Google IdP, which renders Solid screens
  // server-side; without the preload Bun compiles workspace `.tsx` to React JSX
  // and `solid-js/web` under the `node` condition refuses to `render`. Same
  // flags as `@pkgs/auth-sim`'s own test script and `localhost-stack/boot-stack`.
  const harness = Bun.spawn(
    [
      'bun',
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      '@pkgs/bun-test-solid/register',
      './e2e/serve-harness.ts',
    ],
    {
      cwd: `${HERE}/../../auth-sim`,
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  let code = 1;
  try {
    await waitForHttp(ORIGIN);
    const test = Bun.spawn(
      ['bun', 'test', '--timeout', '60000', './e2e/tests'],
      {
        cwd: `${HERE}/..`,
        stdout: 'inherit',
        stderr: 'inherit',
      }
    );
    code = (await test.exited) ?? 1;
  } finally {
    harness.kill();
    try {
      await harness.exited;
    } catch {
      // already dead
    }
    killListenersOnPort(PORT);
  }

  process.exit(code);
} else {
  // No browser here: verify the OAuth contract through the in-process path
  // that does not require Bun.WebView. This runs the same protocol-level contract
  // (token exchange, callback handling, session creation) as the WebView e2e.
  // The IdP renders Solid screens in-process, so it needs the package `test`
  // script's compile flags (Solid browser build + Babel preload).
  const test = Bun.spawn(
    [
      'bun',
      'test',
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      '@pkgs/bun-test-solid/preload',
      '--timeout',
      '60000',
      `${HERE}/../tests/in-process-open-auth-session.integration.test.ts`,
      `${HERE}/../tests/idp-google-sim-screens.test.ts`,
    ],
    {
      cwd: `${HERE}/..`,
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  const code = (await test.exited) ?? 1;
  process.exit(code);
}
