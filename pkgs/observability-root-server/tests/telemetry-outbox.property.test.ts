import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { TelemetryOutbox } from '@pkgs/observability-runtime-shared/telemetry-outbox';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

test('durable delivery preserves every batch across failed uploads and reopening', async () => {
  await assertProperty(
    'telemetry delivery conserves persisted batches',
    fc.asyncProperty(
      fc.array(fc.string({ maxLength: 64 }), { minLength: 1, maxLength: 8 }),
      fc.integer({ min: 0, max: 3 }),
      async (messages, failures) => {
        const time = createHarnessClock();
        const store = new ObjectStoreImplInMemory();
        let id = 0;
        let available = false;
        const accepted: string[] = [];
        const options = {
          ...time,
          store,
          createId: () => String(++id),
          endpoints: {
            traces: 'https://example.test/traces',
            logs: 'https://example.test/logs',
          },
          http: {
            async fetch(_input: RequestInfo | URL, init?: RequestInit) {
              if (!available) return new Response(null, { status: 503 });
              accepted.push(String(init?.body));
              return Response.json({});
            },
          },
        };
        const bodies = messages.map((message) => JSON.stringify({ message }));
        const original = new TelemetryOutbox(options);
        for (const body of bodies)
          await original.http.fetch(options.endpoints.traces, {
            method: 'POST',
            body,
          });
        await expect(original.flush()).rejects.toThrow('rejected');
        original.stop();
        for (let attempt = 0; attempt < failures; attempt++) {
          const reopened = new TelemetryOutbox(options);
          await expect(reopened.flush()).rejects.toThrow('rejected');
          reopened.stop();
          expect(await store.listKeys()).toHaveLength(bodies.length);
        }
        available = true;
        const recovered = new TelemetryOutbox(options);
        await recovered.flush();
        recovered.stop();
        expect(accepted.sort()).toEqual(bodies.toSorted());
        expect(await store.listKeys()).toHaveLength(0);
      }
    )
  );
});
