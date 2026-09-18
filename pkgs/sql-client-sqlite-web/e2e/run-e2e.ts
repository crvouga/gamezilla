// @io-wall-ok — start the sql-client harness then run bun:test

import { killListenersOnPort } from '@pkgs/os/kill-port';
import { waitForHttp } from './webview';

// This harness drives Chromium through `Bun.WebView`, which only works on
// macOS. Off macOS `Bun.WebView` is either absent (Bun 1.3) or present without
// a usable CDP session (Bun 1.4 on Linux: "'Runtime.evaluate' wasn't found"),
// so gate on the platform and skip loudly instead of failing CI's Linux
// check job. turbo.json hashes turbo-platform-key.json for this task, so a
// macOS result can never satisfy a Linux run.
if (process.platform !== 'darwin') {
  console.log(
    `sql-client sqlite-web e2e: skipping on ${process.platform} — this harness needs Bun.WebView (macOS)`
  );
  process.exit(0);
}

const PORT = 4177;
const ORIGIN = `http://127.0.0.1:${PORT}`;

killListenersOnPort(PORT);

const harness = Bun.spawn(['bun', './e2e/serve-harness.ts'], {
  cwd: import.meta.dir + '/..',
  stdout: 'inherit',
  stderr: 'inherit',
});

let code = 1;
try {
  await waitForHttp(ORIGIN);
  const test = Bun.spawn(['bun', 'test', '--timeout', '60000', './e2e/tests'], {
    cwd: import.meta.dir + '/..',
    stdout: 'inherit',
    stderr: 'inherit',
  });
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
