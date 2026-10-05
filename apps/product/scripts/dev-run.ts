// @io-wall-ok — development process entry.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolveDevRepoRoot } from './dev-repo-root';
import { parseStackOptions } from './stack-options';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const options = parseStackOptions(args);
const repoRoot = resolveDevRepoRoot(import.meta.dir, existsSync);
const child = spawn(
  'bun',
  ['x', 'turbo', 'run', 'dev', '--filter=@apps/product', '--ui=tui'],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      LOCALHOST_STACK_ARGS: JSON.stringify([
        ...args,
        '--instance',
        options.instanceId,
      ]),
    },
  }
);
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('error', (error) => {
  throw error;
});
child.on('exit', (code) => process.exit(code ?? 1));
