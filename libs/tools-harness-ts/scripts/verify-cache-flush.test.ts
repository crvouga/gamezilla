import { expect, test } from 'bun:test';
import { DEADLINE_FLUSH_MS } from './verify-budget';
import { cacheFlushStop } from './verify-cache-flush';

// regression: shard-hard-kill-interrupts-cache-uploads
test('shutdown allows uploads to flush, bounds a wedged process, and repeated signals do not shorten the window', () => {
  const signals: NodeJS.Signals[] = [];
  let fire: (() => void) | undefined;
  let delay = 0;
  const stop = cacheFlushStop({
    signal: (signal) => signals.push(signal),
    after: (ms, callback) => {
      delay = ms;
      fire = callback;
      return () => {
        fire = undefined;
      };
    },
  });
  expect(stop.stopping()).toBe(false);
  stop.request();
  stop.request();
  expect(stop.stopping()).toBe(true);
  expect(signals).toEqual(['SIGTERM']);
  expect(delay).toBe(DEADLINE_FLUSH_MS);
  fire?.();
  expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
});

test('Turbo exiting within the flush window cancels the hard kill', () => {
  const signals: NodeJS.Signals[] = [];
  let fire: (() => void) | undefined;
  const stop = cacheFlushStop({
    signal: (signal) => signals.push(signal),
    after: (_ms, callback) => {
      fire = callback;
      return () => {
        fire = undefined;
      };
    },
  });
  stop.request();
  stop.dispose();
  fire?.();
  expect(signals).toEqual(['SIGTERM']);
});

test('cancellation remains recorded even if Turbo exits cleanly while flushing', () => {
  const stop = cacheFlushStop({ signal: () => {}, after: () => () => {} });
  stop.request();
  expect(stop.cancelled()).toBe(false);
  stop.cancel();
  expect(stop.cancelled()).toBe(true);
});
