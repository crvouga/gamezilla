import { describe, expect, test } from 'bun:test';
import { mintPubSubToken } from '@libs/pubsub-server/mint-pubsub-token';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { jwtVerify } from 'jose';

/** 2026-01-01T00:00:00Z — a fixed instant so the verdict never reads the wall. */
const START_MS = 1_767_225_600_000;
const TOKEN_TTL_SEC = 15 * 60;

describe('mintPubSubToken', () => {
  test('embeds subscribe+publish ACL for the actor and whatever subs granted', async () => {
    const secret = 'test-secret';
    const { clock } = createHarnessClock({ startMs: START_MS });
    const { token, expiresAt, topics } = await mintPubSubToken({
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
    // regression: one-refused-room-ends-realtime
    // The client subscribes only to what the token says it grants.
    expect(topics).toEqual(
      acl
        .filter((rule) => rule.action === 'subscribe')
        .map((rule) => rule.topic)
    );
  });
});
