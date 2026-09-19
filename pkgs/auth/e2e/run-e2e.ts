// @io-wall-ok — start the OAuth harness then run bun:test.
// On macOS the harness drives a real browser engine through Bun.WebView.
// On other platforms, exercises the same OAuth contract through the
// in-process open-auth-session path.

import { killListenersOnPort } from '@pkgs/os/kill-port';
import { waitForHttp } from './webview';

const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const HERE = import.meta.dir;

if (process.platform === 'darwin') {
  // Darwin: full Bun.WebView e2e path with real browser automation.
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
      '../idp-google-sim/bun-solid-preload.ts',
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
  // Non-darwin: verify the OAuth contract through the in-process path that
  // does not require Bun.WebView. This runs the same protocol-level contract
  // (token exchange, callback handling, session creation) as the WebView e2e.
  const test = Bun.spawn(
    [
      'bun',
      'test',
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
