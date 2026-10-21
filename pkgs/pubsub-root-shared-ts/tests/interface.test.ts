import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { runPubSubContractTests } from '@pkgs/pubsub-root-shared-ts/contract';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  InMemoryPubSub,
} from '@pkgs/pubsub-root-shared-ts/in-memory';
import {
  decodePayload,
  encodePayload,
  PAYLOAD_MAX_BYTES,
} from '@pkgs/pubsub-root-shared-ts/payload';
import { assertValidTopic } from '@pkgs/pubsub-root-shared-ts/topic';

const logger = createNoopLogger();

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 32; i += 1) await Promise.resolve();
}

/**
 * Virtual clock whose timers fire as soon as the microtask queue is quiet:
 * the contract's `waitMs` / `waitUntil` run on virtual time, never the wall.
 * The in-memory bus delivers synchronously, so nothing is outrun.
 */
function selfAdvancingHarnessClock(): { clock: Clock; timers: Timers } {
  const harness = createHarnessClock();
  let pumping = false;
  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        await flushMicrotasks();
        const due = harness.clock.nextDueAt();
        if (due === null) return;
        harness.clock.set(Math.max(due, harness.clock.now()));
      }
    } finally {
      pumping = false;
    }
  };
  return {
    clock: harness.clock,
    timers: {
      ...harness.timers,
      setTimeout: (fn, ms) => {
        const handle = harness.timers.setTimeout(fn, ms);
        void pump();
        return handle;
      },
    },
  };
}

runPubSubContractTests(
  'in-memory',
  async () => {
    const bus = createInMemoryBus();
    return {
      make: async () => createInMemoryPubSub({ bus, logger }),
      injectMalformedInbound: async (subscriber, topic) => {
        if (!(subscriber instanceof InMemoryPubSub)) {
          throw new Error('expected InMemoryPubSub');
        }
        subscriber.deliverRawForTest(topic, 'not-json{{{');
      },
      ...selfAdvancingHarnessClock(),
      teardown: async () => undefined,
    };
  },
  { supportsDisruptTransport: false }
);

describe('assertValidTopic', () => {
  test('accepts simple and namespaced topics', () => {
    expect(() => assertValidTopic('sql-client')).not.toThrow();
    expect(() => assertValidTopic('user:abc-1')).not.toThrow();
    expect(() => assertValidTopic('a:B_c:9')).not.toThrow();
  });

  test('rejects wildcards hierarchy and bad chars', () => {
    for (const t of ['a/b', 'a+b', 'a#b', 'Hello', '', 'x'.repeat(129)]) {
      expect(() => assertValidTopic(t)).toThrow();
    }
  });
});

describe('payload codec', () => {
  test('round-trips', () => {
    expect(decodePayload(encodePayload({ a: 1 }), logger)).toEqual({ a: 1 });
  });

  test('rejects oversized', () => {
    expect(() => encodePayload('x'.repeat(PAYLOAD_MAX_BYTES))).toThrow();
  });

  test('malformed decode returns undefined and warns', () => {
    const warnings: string[] = [];
    const capturing: Logger = {
      ...createNoopLogger(),
      warn: (msg) => warnings.push(msg),
    };
    expect(decodePayload('{', capturing)).toBeUndefined();
    expect(warnings).toEqual(['malformed payload dropped']);
  });
});
