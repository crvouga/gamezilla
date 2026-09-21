import { describe, expect, test } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createNoopLogger, type Logger } from '@pkgs/logger';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  InMemoryPubSub,
} from './in-memory';
import { runPubSubContractTests } from './in-memory/contract';
import { decodePayload, encodePayload, PAYLOAD_MAX_BYTES } from './payload';
import { assertValidTopic } from './topic';

const logger = createNoopLogger();

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
      clock: wallClock,
      timers: wallTimers,
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
