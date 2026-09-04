// @io-wall-ok — start the sql-client harness then run bun:test

import { waitForHttp } from './webview';

const ORIGIN = 'http://127.0.0.1:4177';

const harness = Bun.spawn(['bun', './e2e/serve-harness.ts'], {
  cwd: import.meta.dir + '/..',
  stdout: 'inherit',
  stderr: 'inherit',
});

try {
  await waitForHttp(ORIGIN);
  const test = Bun.spawn(['bun', 'test', './e2e/tests'], {
    cwd: import.meta.dir + '/..',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await test.exited;
  process.exit(code ?? 1);
} finally {
  harness.kill();
}
