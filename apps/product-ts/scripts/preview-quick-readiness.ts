import type { ChildProcess } from 'node:child_process';
import type { Timers } from '@pkgs/clock-shared-ts/types';

/** Publish only this process's address, and wait for its registered connection. */
export function quickPreviewReady(
  child: ChildProcess,
  timers: Timers,
  publish: (origin: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    let origin: string | null = null;
    let registered = false;
    const finish = (error?: Error): void => {
      timers.clearTimeout(timeout);
      child.removeListener('error', failed);
      child.removeListener('exit', failed);
      child.stderr?.removeListener('data', received);
      if (error !== undefined) reject(error);
      else if (origin !== null) resolve(origin);
    };
    const failed = (): void =>
      finish(
        new Error('Preview tunnel stopped; check connectivity and retry Run')
      );
    const received = (chunk: Buffer): void => {
      text = `${text}${chunk.toString()}`;
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
      if (origin === null && match !== null) {
        origin = match[0];
        try {
          publish(origin);
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
          return;
        }
      }
      registered ||= text.includes('Registered tunnel connection');
      if (registered && origin !== null) finish();
      text = text.slice(-4096);
    };
    const timeout = timers.setTimeout(
      () =>
        finish(
          new Error(
            'Preview tunnel did not connect within 60 seconds; check outbound connectivity and retry Run'
          )
        ),
      60_000
    );
    child.once('error', failed);
    child.once('exit', failed);
    child.stderr?.on('data', received);
  });
}
