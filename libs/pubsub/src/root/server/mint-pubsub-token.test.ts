import { describe, expect, test } from 'bun:test';
import { wallClock } from '@pkgs/clock';
import { jwtVerify } from 'jose';

import { mintPubSubToken } from './mint-pubsub-token';

describe('mintPubSubToken', () => {
  test('embeds subscribe+publish ACL for the actor and whatever features granted', async () => {
    const secret = 'test-secret';
    const { token, expiresAt } = await mintPubSubToken({
      secret,
      actorId: 'actor1',
      featureTopics: ['room:space_a', 'room:space_b'],
      now: wallClock.now,
    });
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    expect(payload.sub).toBe('actor1');
    expect(expiresAt).toBeGreaterThan(Math.floor(wallClock.now() / 1000));
    const acl = payload['acl'] as Array<{
      permission: string;
      action: string;
      topic: string;
    }>;
    expect(acl).toEqual([
      { permission: 'allow', action: 'subscribe', topic: 'user:actor1' },
      { permission: 'allow', action: 'publish', topic: 'user:actor1' },
      {
        permission: 'allow',
        action: 'subscribe',
        topic: 'system:client_config',
      },
      {
        permission: 'allow',
        action: 'publish',
        topic: 'system:client_config',
      },
      { permission: 'allow', action: 'subscribe', topic: 'room:space_a' },
      { permission: 'allow', action: 'publish', topic: 'room:space_a' },
      { permission: 'allow', action: 'subscribe', topic: 'room:space_b' },
      { permission: 'allow', action: 'publish', topic: 'room:space_b' },
    ]);
  });
});
