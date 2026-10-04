// @io-wall-ok
/** Product web app only; the harness console lives in @apps/product. */
import { join } from 'node:path';
import { run } from '@pkgs/os-server/command';

run('bunx', ['--no-install', 'vite', ...process.argv.slice(2)], {
  cwd: join(import.meta.dirname, '..'),
  env: process.env,
});
