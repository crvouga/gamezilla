import { describe, expect, test } from 'bun:test';
import { PubSubClosedError } from '../pubsub-closed-error';
import { createInMemoryPubSub } from './in-memory';

describe('createInMemoryPubSub', () => {
  test('routes through encode decode', async () => {
    const ps = createInMemoryPubSub();
    const got: unknown[] = [];
    ps.subscribe('t', (d) => got.push(d));
    await ps.publish('t', { x: 1 });
    expect(got).toEqual([{ x: 1 }]);
    ps.close();
  });

  test('close is terminal', async () => {
    const ps = createInMemoryPubSub();
    ps.close();
    await expect(ps.publish('t', 1)).rejects.toBeInstanceOf(PubSubClosedError);
  });
});
