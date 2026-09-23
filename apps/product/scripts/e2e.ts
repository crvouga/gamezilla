// @io-wall-ok — `bun e2e`: boot the full app stack, run the product suite on it.
/**
 * Same `tests/` as `bun run --filter @apps/product test`, on the `localhost`
 * profile: real API + room Workers (`wrangler dev`), the built client, and
 * embedded Postgres / MinIO / EMQX. Pass test files (relative to
 * `apps/product`) to focus a run.
 */

import { join } from 'node:path';

import { startLocalAppStack } from '../../../tools/scripts/local-app-stack';

const pkgRoot = join(import.meta.dir, '..');
const args = process.argv.slice(2);
const testFiles = args.length > 0 ? args : ['tests'];

const stack = await startLocalAppStack({
  profile: 'e2e',
  webEntry: join(pkgRoot, 'scripts/serve-e2e-web.ts'),
});

const test = Bun.spawn(
  [
    'bun',
    'test',
    '--conditions=browser',
    '--conditions=development',
    '--preload',
    './bun-babel-plugin.ts',
    '--preload',
    './bun-preload.ts',
    '--timeout',
    '120000',
    ...testFiles,
  ],
  {
    cwd: pkgRoot,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      SIM_PROFILE: 'localhost',
      SIM_WITH_DOM: '0',
      SIM_WEB_ORIGIN: stack.webOrigin,
      SIM_API_ORIGIN: stack.apiOrigin,
      SIM_STACK_DATABASE_URL: stack.databaseUrl,
      NODE_OPTIONS: process.env['NODE_OPTIONS'] ?? '--max-old-space-size=8192',
    },
  }
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    test.kill('SIGTERM');
  });
}

let exitCode = 1;
try {
  exitCode = await Promise.race([
    test.exited,
    stack.exited.then(() => {
      throw new Error('stack stopped during the e2e run');
    }),
  ]);
} catch (error) {
  process.stderr.write(`[e2e] ${String(error)}\n`);
  test.kill('SIGTERM');
  await test.exited;
} finally {
  await stack.stop();
}
process.exit(exitCode);
