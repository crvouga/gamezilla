// @io-wall-ok — start the OAuth harness then run bun:test

import { killListenersOnPort } from '@pkgs/os/kill-port';
import { waitForHttp } from './webview';

const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;

killListenersOnPort(PORT);

const harness = Bun.spawn(['bun', './e2e/serve-harness.ts'], {
  cwd: import.meta.dir + '/../../auth-sim',
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
  harness.kill();
  try {
    await harness.exited;
  } catch {
    // already dead
  }
  killListenersOnPort(PORT);
}

process.exit(code);
