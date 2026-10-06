// @io-wall-ok — keep the admission lease alive while a cancelled check is cleaned up.
import { type ChildProcess, spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

/** A launcher crash closes IPC; the worker cancels before releasing its lease. */
export function watchLocalCheckCancellation(
  controller: AbortController,
  host: Pick<EventEmitter, 'on' | 'off'>
): () => void {
  const cancel = () => controller.abort();
  const onMessage = (message: unknown) => {
    if (message === 'cancel') cancel();
  };
  host.on('disconnect', cancel);
  host.on('message', onMessage);
  return () => {
    host.off('disconnect', cancel);
    host.off('message', onMessage);
  };
}

/** The lightweight launcher remains responsive while its worker holds the lock. */
export function launchLocalCheck(args: readonly string[]): Promise<number> {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('./check-local.ts', import.meta.url)), ...args],
    { stdio: ['inherit', 'inherit', 'inherit', 'ipc'], detached: true }
  );
  return superviseLocalCheck(child, process);
}

export function superviseLocalCheck(
  child: ChildProcess,
  host: Pick<EventEmitter, 'on' | 'off'>
): Promise<number> {
  let cancelled = 0;
  const onInt = () => cancel(130);
  const onTerm = () => cancel(143);
  const onHangup = () => cancel(129);
  function cancel(code: number): void {
    cancelled = code;
    if (child.connected) child.send('cancel', () => {});
  }
  host.on('SIGINT', onInt);
  host.on('SIGTERM', onTerm);
  host.on('SIGHUP', onHangup);
  return new Promise((resolve) => {
    const finish = (code: number) => {
      host.off('SIGINT', onInt);
      host.off('SIGTERM', onTerm);
      host.off('SIGHUP', onHangup);
      resolve(cancelled || code);
    };
    child.once('error', () => finish(1));
    child.once('close', (code) => finish(code ?? 1));
  });
}
