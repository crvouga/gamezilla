/**
 * Local / convenience orchestrator for the three parallel CI Turbo jobs
 * (`turbo-gates`, `turbo-verify`, `turbo-build`). Full `bun run check`
 * also includes static + API + browser lanes via `tools/scripts/check.ts`.
 */
import { spawn } from 'node:child_process';

const SCRIPTS = [
  'check:ci:gates',
  'check:ci:verify',
  'check:ci:build',
] as const;

function runScript(script: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('bun', ['run', script], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', (err) => {
      console.error(`check-ci: failed to spawn ${script}:`, err);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

const codes = await Promise.all(SCRIPTS.map((s) => runScript(s)));
const failed = SCRIPTS.filter((_, i) => codes[i] !== 0);
if (failed.length > 0) {
  console.error(`check-ci: failed: ${failed.join(', ')}`);
  process.exit(1);
}
process.exit(0);
