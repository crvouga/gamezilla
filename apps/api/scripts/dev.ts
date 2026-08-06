/**
 * Foreground entry for `@apps/api dev`. Runs migrate → client-config refresh →
 * wrangler under one Node process so turbo SIGINT/SIGTERM tear down the whole
 * tree instead of leaving a shell background job alive.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

const API_DIR = join(import.meta.dirname, '..');
const REPO_ROOT = join(API_DIR, '../..');
const API_PORT = 8788;
/** `0` = OS-assigned free port. Fixed 9229/9231 hit EADDRNOTAVAIL on some hosts. */
const INSPECTOR_PORT = 0;

const children: ChildProcess[] = [];
let shuttingDown = false;

function killChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // process may have exited
  }
}

function killChildren(): void {
  for (const child of children) {
    killChild(child, 'SIGTERM');
  }
  setTimeout(() => {
    for (const child of children) {
      killChild(child, 'SIGKILL');
    }
  }, 2_000);
}

function shutdown(exitCode: number): void {
  if (shuttingDown) return;
  shuttingDown = true;
  killChildren();
  process.exit(exitCode);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(sig, () => {
    const codes: Record<string, number> = {
      SIGHUP: 129,
      SIGINT: 130,
      SIGTERM: 143,
    };
    shutdown(codes[sig] ?? 1);
  });
}

const migrate = spawnSync('bun', ['run', 'scripts/migrate-db.ts', '--wait'], {
  cwd: API_DIR,
  stdio: 'inherit',
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const refresh = spawn(
  'bun',
  ['run', '--filter', '@libs/client-config', 'dev:refresh'],
  { cwd: REPO_ROOT, stdio: 'inherit' }
);
children.push(refresh);

const wrangler = spawn(
  'wrangler',
  [
    'dev',
    '--port',
    String(API_PORT),
    '--inspector-port',
    String(INSPECTOR_PORT),
  ],
  { cwd: API_DIR, stdio: 'inherit' }
);
children.push(wrangler);

const exitCode = await new Promise<number>((resolve) => {
  wrangler.on('exit', (code) => resolve(code ?? 1));
});

killChildren();
process.exit(exitCode);
