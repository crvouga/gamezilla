// @io-wall-ok — start the sql-client harness then run bun:test.
// The harness drives Chrome through Bun.WebView (macOS and Linux CI alike).
// Only a local machine with no Chrome exercises the same SQLite worker
// protocol through the in-process MessageChannel path (broker-core,
// owner-handlers, RPC).

import { killListenersOnPort } from '@pkgs/os/kill-port';
import { resolveE2eBrowser } from '@pkgs/ui-testing-bun-webview/e2e-browser';
import { waitForHttp } from './webview';

const PORT = 4177;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const HERE = import.meta.dir;

// The tests always ask for `backend: 'chrome'`; on macOS Bun finds the
// installed app, elsewhere this resolves (or, in CI, insists on) a Chrome.
if (resolveE2eBrowser().engine !== null) {
  // Full Bun.WebView e2e path with a real Chrome (SharedWorker + OPFS).
  killListenersOnPort(PORT);

  const harness = Bun.spawn(['bun', './e2e/serve-harness.ts'], {
    cwd: `${HERE}/..`,
    stdout: 'inherit',
    stderr: 'inherit',
  });

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
    // Must tear down before process.exit — otherwise turbo waits forever on the
    // task log pipe held open by the lingering harness listen socket.
    harness.kill('SIGKILL');
    try {
      await Promise.race([harness.exited, Bun.sleep(2_000)]);
    } catch {
      // already gone
    }
    killListenersOnPort(PORT);
  }

  process.exit(code);
} else {
  // No Chrome: verify the SQLite worker protocol through the in-process
  // MessageChannel path that does not require Bun.WebView or Chromium.
  // This covers the same core RPC, broker, and owner-handler paths as the
  // WebView e2e but without a real browser renderer.
  const test = Bun.spawn(
    [
      'bun',
      'test',
      '--timeout',
      '60000',
      `${HERE}/../tests/sqlite-worker.test.ts`,
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
