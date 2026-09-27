import { describe, expect, test } from 'bun:test';
import { createSimClock } from '@pkgs/clock';
import { jwtVerify } from 'jose';

import { mintPubSubToken } from './mint-pubsub-token';

/** 2026-01-01T00:00:00Z — a fixed instant so the verdict never reads the wall. */
const START_MS = 1_767_225_600_000;
const TOKEN_TTL_SEC = 15 * 60;

describe('mintPubSubToken', () => {
  test('embeds subscribe+publish ACL for the actor and whatever features granted', async () => {
    const secret = 'test-secret';
    const { clock } = createSimClock({ startMs: START_MS });
    const { token, expiresAt } = await mintPubSubToken({
      secret,
      actorId: 'actor1',
      featureTopics: ['room:space_a', 'room:space_b'],
      now: clock.now,
    });
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { currentDate: new Date(clock.now()) }
    );
    expect(payload.sub).toBe('actor1');
    expect(expiresAt).toBe(START_MS / 1000 + TOKEN_TTL_SEC);
    expect(payload.exp).toBe(expiresAt);
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
