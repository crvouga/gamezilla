import { describe, expect, test } from 'bun:test';
import { decodePayload, encodePayload, PAYLOAD_MAX_BYTES } from './payload';
import { assertValidTopic } from './topic';
import {
  createInMemoryBus,
  createInMemoryPubSub,
  InMemoryPubSub,
  runPubSubContractTests,
} from './testing';

runPubSubContractTests('in-memory', async () => {
  const bus = createInMemoryBus();
  return {
    make: async () => createInMemoryPubSub(bus),
    injectMalformedInbound: async (subscriber, topic) => {
      if (!(subscriber instanceof InMemoryPubSub)) {
        throw new Error('expected InMemoryPubSub');
      }
      subscriber.deliverRawForTest(topic, 'not-json{{{');
    },
    teardown: async () => undefined,
  };
});

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
    expect(decodePayload(encodePayload({ a: 1 }))).toEqual({ a: 1 });
  });

  test('rejects oversized', () => {
    expect(() => encodePayload('x'.repeat(PAYLOAD_MAX_BYTES))).toThrow();
  });

  test('malformed decode returns undefined', () => {
    expect(decodePayload('{')).toBeUndefined();
  });
});
