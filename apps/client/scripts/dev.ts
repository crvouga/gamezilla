// @io-wall-ok
/** Product web app only; the simulator console lives in @apps/product. */
import { join } from 'node:path';
import { run } from '@pkgs/os';

run('bunx', ['--no-install', 'vite', ...process.argv.slice(2)], {
  cwd: join(import.meta.dirname, '..'),
  env: process.env,
});
