// @io-wall-ok — live environment verify: bounded read-only CLI subprocess groups.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { boundedOperation } from '@libs/infra-shared-ts/bounded-operation';
import { DRIFT_STOP_SIGNALS } from '@libs/infra-shared-ts/drift-process-policy';
import type { Stack } from '@libs/infra-shared-ts/tofu-command';
import { ENV_STACKS } from '@libs/infra-shared-ts/tofu-command';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';

const SCRIPT = join(import.meta.dirname, 'tofu.ts');
const STACK_TIMEOUT_MS = 6 * 60 * 1000;
/** Time for OpenTofu to release a state lock after SIGINT before SIGKILL. */
const STOP_GRACE_MS = 5_000;

/** Both stacks must have no diff and pass the existing stateful-resource policy. */
export async function verifyDeclaredEnvironment(): Promise<void> {
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
  let killTimer: unknown;
  const stop = () => {
    // Interrupt first so OpenTofu can release its lock; kill leftovers after.
    // Drift also plans with `-lock=false`, so a hard kill cannot abandon state.
    try {
      process.kill(-child.pid!, DRIFT_STOP_SIGNALS[0]);
    } catch {}
    killTimer = wallTimers.setTimeout(() => {
      try {
        process.kill(-child.pid!, DRIFT_STOP_SIGNALS[1]);
      } catch {}
    }, STOP_GRACE_MS);
  };
  signal.addEventListener('abort', stop, { once: true });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      wallTimers.clearTimeout(killTimer);
      signal.removeEventListener('abort', stop);
      process.off('SIGTERM', stop);
      process.off('SIGINT', stop);
      resolve(code ?? 1);
    });
  });
}
