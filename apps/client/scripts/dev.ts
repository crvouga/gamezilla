// @io-wall-ok
/** Product web app only; console + local reports live in @product/console. */
import { join } from 'node:path';
import { run } from '@pkgs/os';

run('bunx', ['--no-install', 'vite', ...process.argv.slice(2)], {
  cwd: join(import.meta.dirname, '..'),
  env: process.env,
});
