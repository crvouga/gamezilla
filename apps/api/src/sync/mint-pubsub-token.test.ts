import { describe, expect, test } from 'bun:test';
import { jwtVerify } from 'jose';

import { mintPubSubToken } from './mint-pubsub-token';

describe('mintPubSubToken', () => {
  test('embeds subscribe+publish ACL for user and rooms', async () => {
    const secret = 'test-secret';
    const { token, expiresAt } = await mintPubSubToken({
      secret,
      actorId: 'actor1',
      spaceIds: ['space_a', 'space_b'],
    });
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    expect(payload.sub).toBe('actor1');
    expect(expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
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
