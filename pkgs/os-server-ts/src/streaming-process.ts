import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';

export interface StreamingProcess {
  readonly stdout: Readable;
  readonly stderr: Readable;
  /** The exit code; `null` when a signal (or, on Windows, a kill) ended it. */
  readonly completed: Promise<number | null>;
  /** Kill at once (`SIGKILL`). */
  stop(): void;
  /**
   * Ask the process to end (`SIGTERM`), so it can clean up and pick its exit
   * code. Windows has no signals: there the process is ended at once, as
   * `stop` does, no handler of its runs, and `completed` resolves `null`.
   */
  terminate(): void;
}

export interface ProcessRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly signal?: AbortSignal;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
}

/** Shell-free streaming process; consumers drain both pipes and await completion. */
export function startProcess(request: ProcessRequest): StreamingProcess {
  request.signal?.throwIfAborted();
  const child = spawn(request.command, [...request.args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...(request.env === undefined ? {} : { env: request.env }),
    ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
  });
  const stop = () => {
    child.kill('SIGKILL');
  };
  request.signal?.addEventListener('abort', stop, { once: true });
  const completed = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      request.signal?.removeEventListener('abort', stop);
      resolve(code);
    });
  });
  // A consumer can be between pipe reads when spawn fails.
  void completed.catch(() => undefined);
  return {
    stdout: child.stdout,
    stderr: child.stderr,
    completed,
    stop,
    terminate: () => {
      child.kill('SIGTERM');
    },
  };
}
