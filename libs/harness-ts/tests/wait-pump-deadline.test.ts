import { expect, test } from 'bun:test';
import { createHarnessNet } from '@libs/harness-ts/net';
import { createSerializedRunFor } from '@libs/harness-ts/wait-pump';
import { createVirtualClock } from '@pkgs/harness-root-shared-ts/clock';
import { createScheduler } from '@pkgs/harness-root-shared-ts/scheduler';
import { createTimers } from '@pkgs/harness-root-shared-ts/timers';
import { createDeadlineFetch } from '@pkgs/http-client-shared-ts/deadline-fetch';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';

// regression: harness-advance-expires-healthy-http
test('two quiet minutes let healthy HTTP finish before its request deadline', async () => {
  const clock = createVirtualClock();
  const scheduler = createScheduler(clock);
  let answer: (() => void) | undefined;
  const fetch = createDeadlineFetch({
    timers: createTimers(scheduler),
    fetch: () =>
      new Promise<Response>((resolve) => {
        answer = () =>
          resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  setImmediate(() => {
                    controller.enqueue(new TextEncoder().encode('accepted'));
                    controller.close();
                  });
                },
              })
            )
          );
      }),
  });
  let result: unknown;
  scheduler.scheduleAfter(100, () => {
    void fetch('https://app.example.invalid/api/mutations')
      .then((response) => response.text())
      .then(
        (text) => {
          result = text;
        },
        (error: unknown) => {
          result = error;
        }
      );
  });
  const runFor = createSerializedRunFor(scheduler, {
    after: async () => {
      answer?.();
    },
  });
  await runFor(120_000);
  expect(result).toBe('accepted');
  expect(clock.now()).toBe(120_000);
});

test('a deliberately held answer still reaches its virtual request deadline', async () => {
  const clock = createVirtualClock();
  const scheduler = createScheduler(clock);
  const net = createHarnessNet();
  let accepted = 0;
  net.holdHttp('alice', '/api/mutations').acceptWithoutAnswer();
  const fetch = createDeadlineFetch({
    timers: createTimers(scheduler),
    fetch: net.wrapHop('alice', 'server', async () => {
      accepted++;
      return new Response('accepted');
    }),
  });
  let result: unknown;
  scheduler.scheduleAfter(100, () => {
    void fetch('https://app.example.invalid/api/mutations', {
      method: 'POST',
    }).catch((error: unknown) => {
      result = error;
    });
  });
  await createSerializedRunFor(scheduler)(120_000);
  expect(accepted).toBe(1);
  expect(result).toBeInstanceOf(HttpNetworkError);
  expect(clock.now()).toBe(120_000);
});
