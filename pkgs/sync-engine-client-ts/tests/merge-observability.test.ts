import { afterEach, expect, test } from 'bun:test';
import {
  type Span,
  SpanStatusCode,
  type Tracer,
  trace,
} from '@opentelemetry/api';
import { withMergeSingleFlight } from '@pkgs/sync-engine-client-ts/merge';

afterEach(() => trace.disable());

test('merge traces separate waiting from execution and close on failure', async () => {
  const events: string[] = [];
  const tracer = {
    startActiveSpan(
      name: string,
      _options: unknown,
      callback: (span: Span) => unknown
    ) {
      events.push(`start:${name}`);
      const span = {
        end: () => events.push(`end:${name}`),
        recordException: () => events.push(`error:${name}`),
        setStatus: (status: { code: number }) => {
          expect(status.code).toBe(SpanStatusCode.ERROR);
        },
      } as unknown as Span;
      return callback(span);
    },
  } as unknown as Tracer;
  trace.setGlobalTracerProvider({ getTracer: () => tracer });
  const db = {};
  let release: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = withMergeSingleFlight(db, async () => {
    await blocked;
    throw new Error('failed write');
  });
  const rejected = first.catch((error: unknown) => error);
  const second = withMergeSingleFlight(db, async () => 'saved');
  // Drain promise continuations without advancing any wall clock.
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  expect(
    events.filter((event) => event === 'start:sync.work.merge')
  ).toHaveLength(1);
  expect(
    events.filter((event) => event === 'end:sync.work.queue')
  ).toHaveLength(1);
  release();
  expect(await rejected).toEqual(new Error('failed write'));
  expect(await second).toBe('saved');
  expect(
    events.filter((event) => event === 'end:sync.work.queue')
  ).toHaveLength(2);
  expect(
    events.filter((event) => event === 'end:sync.work.merge')
  ).toHaveLength(2);
  expect(
    events.filter((event) => event === 'error:sync.work.merge')
  ).toHaveLength(1);
});
