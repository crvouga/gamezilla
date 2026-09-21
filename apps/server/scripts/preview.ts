/**
 * Preview entry: migrate (in-process) then wrangler preview serve.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { migratePostgresApp } from '@libs/runtime/root/server/migrate';

const API_DIR = join(import.meta.dirname, '..');

await migratePostgresApp({ wait: true });

const serve = spawnSync('bun', ['run', 'scripts/preview-serve.ts'], {
  cwd: API_DIR,
  stdio: 'inherit',
});
process.exit(serve.status ?? 1);
