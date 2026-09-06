// @io-wall-ok
/** Vite dev server for the Solid console (reports + playground). */
import { join } from 'node:path';
import { run } from '@pkgs/os';

run('bunx', ['--no-install', 'vite', ...process.argv.slice(2)], {
  cwd: join(import.meta.dirname, '..'),
  env: process.env,
});
