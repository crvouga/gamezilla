/**
 * Start Expo web dev with a raised fd ceiling before Metro boots.
 * `ulimit` is a shell builtin, so it lives here instead of package.json scripts.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(scriptDir, '..');
const expoBin = join(clientRoot, 'node_modules', '.bin', 'expo');
const port = String(process.env['EXPO_DEV_PORT'] ?? 5173);

function spawnDevServer(passthrough: string[]): ChildProcess {
  const args = ['start', '--web', '--port', port, '--clear', ...passthrough];
  process.stdout.write(`[client-dev] expo ${args.join(' ')}\n`);
  return spawn(
    'sh',
    ['-c', 'ulimit -n 65536 2>/dev/null || true; exec "$0" "$@"', expoBin, ...args],
    {
      stdio: 'inherit',
      cwd: clientRoot,
      env: process.env,
    }
  );
}

const child = spawnDevServer(process.argv.slice(2).filter((arg) => arg !== '--'));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    child.kill(sig);
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
