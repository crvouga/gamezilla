// @io-wall-ok — product test command entry.
import { run } from '@pkgs/os';

const profile = process.env['SIM_PROFILE']?.trim() || 'in-process';

let args: readonly string[];
if (profile === 'in-process') {
  args = ['x', 'turbo', 'test', '-F', '@apps/product', '--force'];
} else if (profile === 'localhost:mocked') {
  args = ['run', '--filter', '@apps/product', 'test:localhost:mocked'];
} else if (profile === 'localhost') {
  args = ['run', '--filter', '@apps/product', 'test:localhost'];
} else {
  throw new Error(`invalid SIM_PROFILE: ${profile}`);
}

try {
  run('bun', args, {
    env: {
      ...process.env,
      ...(profile === 'in-process' ? { SIM_REPORT: '0' } : {}),
    },
  });
} catch (error) {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
}
