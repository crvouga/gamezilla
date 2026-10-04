// @io-wall-ok — live environment check: bounded read-only CLI subprocess groups.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { boundedOperation } from '@libs/infra-shared/bounded-operation';
import { ENV_STACKS } from '@libs/infra-shared/tofu-command';
import type { Stack } from '@libs/infra-shared/tofu-command';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';

const SCRIPT = join(import.meta.dirname, 'tofu.ts');
const STACK_TIMEOUT_MS = 6 * 60 * 1000;

/** Both stacks must have no diff and pass the existing stateful-resource policy. */
export async function checkDeclaredEnvironment(): Promise<void> {
  for (const stack of ENV_STACKS) {
    const label = `drift ${stack}/${process.env['SECRETS_ENV'] ?? 'unset'}`;
    const status = await boundedOperation(
      (signal) => runStack(stack, signal),
      wallClock,
      wallTimers,
      {
        label,
        timeoutMs: STACK_TIMEOUT_MS,
        report: (message) => console.log(`[infra] ${message}`),
      }
    );
    if (status !== 0)
      throw new Error(
        `${label}: command bun run tofu.ts drift --stack ${stack} exited ${status}`
      );
  }
}

function runStack(stack: Stack, signal: AbortSignal): Promise<number> {
  const child = spawn('bun', ['run', SCRIPT, 'drift', '--stack', stack], {
    detached: true,
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const stop = () => {
    // Read-only process: kill the group, including provider children, without
    // interrupting any apply or deleting the shared state lock.
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {}
  };
  signal.addEventListener('abort', stop, { once: true });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      signal.removeEventListener('abort', stop);
      process.off('SIGTERM', stop);
      process.off('SIGINT', stop);
      resolve(code ?? 1);
    });
  });
}
