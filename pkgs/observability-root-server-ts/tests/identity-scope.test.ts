import { afterEach, expect, test } from 'bun:test';
import { context, propagation, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { createNodeTelemetry } from '@pkgs/observability-root-server-ts/node-node';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import {
  bindIdentity,
  withIdentityScope,
} from '@pkgs/observability-root-shared-ts/identity-scope';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

afterEach(() => {
  trace.disable();
  context.disable();
  propagation.disable();
});

/** Interleaves concurrent requests without a clock. */
async function yieldTurns(turns: number): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
}

function telemetry() {
  const exporter = new InMemorySpanExporter();
  const runtime = createNodeTelemetry({
    serviceName: 'identity-test',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    exporter,
  });
  return { exporter, runtime };
}

function byName(exporter: InMemorySpanExporter) {
  return new Map(
    exporter.getFinishedSpans().map((span) => [span.name, span.attributes])
  );
}

test('identity learned mid-request reaches the open spans and every later one', async () => {
  const { exporter, runtime } = telemetry();
  await withIdentityScope(() =>
    withSpan('test.request', async () => {
      await withSpan('test.before_auth', () => undefined);
      bindIdentity({ userId: 'user-1', deviceId: 'device-1' });
      await withSpan('test.after_auth', async () => {
        await withSpan('test.nested', () => undefined);
      });
    })
  );
  await runtime.forceFlush();
  const spans = byName(exporter);
  // The request span was open when identity was learned; the span that had
  // already ended was not, and is found through its trace.
  expect(spans.get('test.request')?.[ATTR.USER_ID]).toBe('user-1');
  expect(spans.get('test.request')?.[ATTR.APP_DEVICE_ID]).toBe('device-1');
  expect(spans.get('test.before_auth')?.[ATTR.USER_ID]).toBeUndefined();
  expect(spans.get('test.after_auth')?.[ATTR.USER_ID]).toBe('user-1');
  expect(spans.get('test.nested')?.[ATTR.APP_DEVICE_ID]).toBe('device-1');
  await runtime.shutdown();
});

test('concurrent requests never lend each other an identity', async () => {
  await assertProperty(
    'identity scopes are isolated',
    fc.asyncProperty(
      fc.uniqueArray(fc.uuid(), { minLength: 2, maxLength: 6 }),
      async (users) => {
        const { exporter, runtime } = telemetry();
        await Promise.all(
          users.map((user, index) =>
            withIdentityScope(() =>
              withSpan(`test.request_${index}`, async () => {
                await yieldTurns(5 - (index % 5));
                bindIdentity({ userId: user });
                await yieldTurns(index % 3);
                await withSpan(`test.work_${index}`, () => undefined);
              })
            )
          )
        );
        await runtime.forceFlush();
        const spans = byName(exporter);
        for (const [index, user] of users.entries()) {
          expect(spans.get(`test.request_${index}`)?.[ATTR.USER_ID]).toBe(user);
          expect(spans.get(`test.work_${index}`)?.[ATTR.USER_ID]).toBe(user);
        }
        await runtime.shutdown();
        trace.disable();
        context.disable();
      }
    )
  );
});

test('outside a scope binding stamps only the active span', async () => {
  const { exporter, runtime } = telemetry();
  await withSpan('test.lone', async () => {
    bindIdentity({ userId: 'user-9' });
    await withSpan('test.child', () => undefined);
  });
  await runtime.forceFlush();
  const spans = byName(exporter);
  expect(spans.get('test.lone')?.[ATTR.USER_ID]).toBe('user-9');
  expect(spans.get('test.child')?.[ATTR.USER_ID]).toBeUndefined();
  await runtime.shutdown();
});
