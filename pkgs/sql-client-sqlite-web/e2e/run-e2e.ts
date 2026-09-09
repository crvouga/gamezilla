// @io-wall-ok — start the sql-client harness then run bun:test

import { killListenersOnPort } from '@pkgs/os/kill-port';
import { waitForHttp } from './webview';

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
