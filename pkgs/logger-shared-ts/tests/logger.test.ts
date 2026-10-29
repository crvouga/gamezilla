import { afterEach, expect, test } from 'bun:test';

import { createLogger } from '@pkgs/logger-shared-ts/logger';

const LOG_EVENT_BRIDGE = Symbol.for('@pkgs/observability.log-event');

afterEach(() => {
  delete (globalThis as { [LOG_EVENT_BRIDGE]?: unknown })[LOG_EVENT_BRIDGE];
});

test('preserves the sink and forwards safe fields to the telemetry bridge', () => {
  const sink: string[] = [];
  const logSink = createSink(sink);
  const events: unknown[] = [];
  (globalThis as { [LOG_EVENT_BRIDGE]?: (event: unknown) => void })[
    LOG_EVENT_BRIDGE
  ] = (event) => events.push(event);
  const logger = createLogger({
    name: 'sync',
    level: 'info',
    now: () => 0,
    sink: logSink,
  });

  logger.info('batch complete', { privateValue: 'console-only' });

  expect(sink[0]).toContain('privateValue');
  expect(events).toEqual([
    { severity: 'info', message: 'batch complete', loggerName: 'sync' },
  ]);
  expect(JSON.stringify(events)).not.toContain('privateValue');
});

test('keeps startup logs when no span is active', () => {
  const sink: string[] = [];
  createLogger({
    name: 'startup',
    level: 'info',
    now: () => 0,
    sink: createSink(sink),
  }).info('ready');
  expect(sink).toHaveLength(1);
  expect(sink[0]).toContain('ready');
});

function createSink(entries: string[]) {
  return {
    debug: (payload: string) => entries.push(payload),
    info: (payload: string) => entries.push(payload),
    warn: (payload: string) => entries.push(payload),
    error: (payload: string) => entries.push(payload),
  };
}
