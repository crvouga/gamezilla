import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { openLocalVerifyLease } from './local-verify-lease';
import {
  superviseLocalVerify,
  watchLocalVerifyCancellation,
} from './local-verify-process';

test.each(['disconnect', 'message'])(
  'launcher %s cancels the worker so cleanup precedes lock release',
  (event) => {
    const host = new EventEmitter();
    const controller = new AbortController();
    const stop = watchLocalVerifyCancellation(controller, host);
    host.emit('message', 'unrelated');
    expect(controller.signal.aborted).toBe(false);
    host.emit(event, 'cancel');
    expect(controller.signal.aborted).toBe(true);
    stop();
    expect(host.listenerCount('disconnect')).toBe(0);
    expect(host.listenerCount('message')).toBe(0);
  }
);

test('completed workers stop listening to the launcher', () => {
  const host = new EventEmitter();
  const controller = new AbortController();
  watchLocalVerifyCancellation(controller, host)();
  host.emit('disconnect');
  expect(controller.signal.aborted).toBe(false);
});

// regression: local-verify-worktree-memory-contention
test.each(['cancel', 'disconnect', 'crash'])(
  '%s releases cross-process admission after worker cleanup',
  async (mode) => {
    const root = mkdtempSync(join(tmpdir(), 'local-verify-worker-'));
    const path = join(root, 'lease.sqlite');
    const host = new EventEmitter();
    const child = spawn(
      process.execPath,
      [join(import.meta.dirname, 'local-verify-process-fixture.ts'), path],
      { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }
    );
    const ready = new Promise<void>((resolve, reject) => {
      child.once('message', (message) => {
        if (message === 'ready') resolve();
        else
          reject(new Error(`Unexpected fixture message: ${String(message)}`));
      });
      child.once('error', reject);
      child.once('exit', () =>
        reject(new Error('Fixture exited before ready'))
      );
    });
    const verdict = superviseLocalVerify(child, host);
    const waiter = openLocalVerifyLease(path);
    try {
      await ready;
      expect(waiter.tryAcquire()).toBe(false);
      if (mode === 'cancel') {
        const cleaning = new Promise<void>((resolve) => {
          child.once('message', () => resolve());
        });
        host.emit('SIGINT');
        await cleaning;
        expect(waiter.tryAcquire()).toBe(false);
        child.send('cleanup complete');
      } else if (mode === 'disconnect') child.disconnect();
      else child.kill('SIGKILL');
      expect(await verdict).toBe(mode === 'crash' ? 1 : 130);
      expect(waiter.tryAcquire()).toBe(true);
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
        expect(host.listenerCount(signal)).toBe(0);
    } finally {
      child.kill('SIGKILL');
      await verdict;
      waiter.close();
      removeTree(root, { whenLocked: 'leave' });
    }
  }
);
