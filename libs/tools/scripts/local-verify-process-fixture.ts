// @io-wall-ok — automated process/lease contract fixture, driven by IPC without wall timers.
import { openLocalVerifyLease } from './local-verify-lease';
import { watchLocalVerifyCancellation } from './local-verify-process';

const path = process.argv[2];
if (path === undefined) throw new Error('Missing fixture lease path');
const controller = new AbortController();
const stop = watchLocalVerifyCancellation(controller, process);
const lease = openLocalVerifyLease(path);
try {
  if (!lease.tryAcquire()) throw new Error('Fixture lease already held');
  const aborted = new Promise<void>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve(), {
      once: true,
    });
  });
  process.send?.('ready');
  await aborted;
  if (process.connected) {
    const cleanup = new Promise<void>((resolve) => {
      process.once('message', () => resolve());
    });
    process.send?.('cleaning');
    await cleanup;
  }
} finally {
  lease.close();
  stop();
  if (process.connected) process.disconnect();
}
process.exitCode = 130;
