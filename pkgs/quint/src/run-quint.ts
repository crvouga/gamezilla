// @io-wall-ok — owns the checker and its entire process group.

import { spawn } from 'node:child_process';
import { wallDeadline } from './wall';

export type QuintRun = {
  readonly code: number | null;
  readonly timedOut: boolean;
  readonly output: string;
};

/** Kill a process group, if any of it is left. */
function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/**
 * Kill the group if this process exits, or is interrupted, first: a detached
 * group gets no Ctrl-C of its own. The signal is re-raised once the group is
 * gone, so the process still ends as it would have. Returns the release.
 */
function guardGroup(pid: number | undefined): () => void {
  const onExit = () => killGroup(pid);
  const onSignal = (signal: NodeJS.Signals) => {
    killGroup(pid);
    release();
    process.kill(process.pid, signal);
  };
  const release = () => {
    process.removeListener('exit', onExit);
    for (const signal of SIGNALS) process.removeListener(signal, onSignal);
  };
  process.once('exit', onExit);
  for (const signal of SIGNALS) process.once(signal, onSignal);
  return release;
}

export async function runQuint(input: {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Record<string, string>;
  readonly timeoutMs: number;
}): Promise<QuintRun> {
  // Its own process group: Quint and the Apalache server it starts die
  // together, whatever state either is in.
  const child = spawn(process.execPath, input.args, {
    cwd: input.cwd,
    env: input.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chunks: string[] = [];
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
  const release = guardGroup(child.pid);
  let timedOut = false;
  const cancel = wallDeadline(input.timeoutMs, () => {
    timedOut = true;
    killGroup(child.pid);
  });
  try {
    const code = await new Promise<number | null>((resolve) => {
      child.once('error', (error) => {
        chunks.push(String(error));
        resolve(null);
      });
      // Quint's exit ends the check; its server shares the output pipes, so
      // the group goes before waiting for them to close.
      child.once('exit', (exitCode) => {
        killGroup(child.pid);
        resolve(exitCode);
      });
    });
    await new Promise<void>((resolve) => {
      if (child.stdout.closed && child.stderr.closed) resolve();
      else child.once('close', () => resolve());
    });
    return { code, timedOut, output: chunks.join('') };
  } finally {
    cancel();
    killGroup(child.pid);
    release();
  }
}
