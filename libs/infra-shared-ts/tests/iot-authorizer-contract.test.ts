import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  authorize,
  MAX_POLICY_CHARACTERS,
  MAX_POLICY_DOCUMENTS,
} from '../tofu/modules/pubsub/authorizer/index.mjs';

const config = {
  tokenSecret: 'test-secret',
  region: 'us-east-1',
  accountId: '123456789012',
  nowSec: 1_792_085_280,
};

function roomRules(index: number) {
  const topic = `room:00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return (['subscribe', 'publish'] as const).map((action) => ({
    permission: 'allow',
    action,
    topic,
  }));
}

function connect(subject: string, remaining = 900, rooms = 0) {
  const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: subject,
      exp: config.nowSec + remaining,
      acl: [
        { permission: 'allow', action: 'subscribe', topic: `user:${subject}` },
        { permission: 'allow', action: 'publish', topic: `user:${subject}` },
        ...Array.from({ length: rooms }, (_, i) => roomRules(i)).flat(),
      ],
    })
  ).toString('base64url');
  const signature = createHmac('sha256', config.tokenSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return authorize(
    {
      protocolData: {
        mqtt: {
          clientId: 'device',
          password: Buffer.from(`${header}.${payload}.${signature}`).toString(
            'base64'
          ),
        },
      },
    },
    config
  );
}

// regression: iot-authorizer-invalid-principal
// The first failed live journey's actor, not an alphabetic fixture identity.
test('a UUID actor gets a valid AWS IoT principal without changing its topic grant', () => {
  const subject = 'c05b7cd3-4e33-433c-9de1-a08504f4062e';
  const result = connect(subject);
  expect(result.isAuthenticated).toBe(true);
  expect(result.principalId).toMatch(/^[a-zA-Z0-9]{1,128}$/);
  expect(JSON.stringify(result.policyDocuments)).toContain(`user/${subject}`);
});

// regression: iot-authorizer-short-lived-token
test('a subject with one second left cannot receive an AWS session', () => {
  expect(connect(' ', 1)).toEqual({ isAuthenticated: false });
});

test('every accepted identity and lifetime obeys the AWS authorizer response contract', () => {
  assertProperty(
    'AWS IoT authorizer contract',
    fc.property(
      fc.string({ minLength: 1, maxLength: 200 }),
      fc.integer({ min: 1, max: 100_000 }),
      (subject, remaining) => {
        const result = connect(subject, remaining);
        if (remaining < 300) {
          expect(result.isAuthenticated).toBe(false);
          return;
        }
        expect(result.isAuthenticated).toBe(true);
        expect(result.principalId).toMatch(/^[a-zA-Z0-9]{1,128}$/);
        expect(result.disconnectAfterInSeconds).toBeGreaterThanOrEqual(300);
        expect(result.disconnectAfterInSeconds).toBeLessThanOrEqual(
          Math.min(remaining, 86_400)
        );
        expect(result.refreshAfterInSeconds).toBeGreaterThanOrEqual(300);
        expect(result.refreshAfterInSeconds).toBeLessThanOrEqual(
          result.disconnectAfterInSeconds ?? 0
        );
        expect(connect(subject, remaining).principalId).toBe(
          result.principalId
        );
      }
    )
  );
});

type PolicyStatement = { Action: string; Resource: string | string[] };
type Policy = { Statement: PolicyStatement[] };

function granted(policies: readonly Policy[], action: string): string[] {
  return policies
    .flatMap((policy) => policy.Statement)
    .filter((statement) => statement.Action === action)
    .flatMap((statement) => [statement.Resource].flat());
}

// regression: iot-policy-over-2048-characters
// Five rooms made one policy document 2,082 characters; AWS IoT closes the
// connection of a person whose document is over 2,048, so every device of
// the synthetic monitor reconnected forever once it was in five spaces.
test('a person in five rooms gets a session AWS IoT accepts and keeps every grant', () => {
  const result = connect('monitor', 900, 5);
  const policies = (result.policyDocuments ?? []) as Policy[];
  for (const policy of policies) {
    expect(JSON.stringify(policy).length).toBeLessThanOrEqual(
      MAX_POLICY_CHARACTERS
    );
  }
  expect(granted(policies, 'iot:Subscribe')).toHaveLength(6);
  expect(granted(policies, 'iot:Receive')).toHaveLength(6);
  expect(granted(policies, 'iot:Publish')).toHaveLength(6);
});

test('however many rooms a person is in, the session obeys the AWS policy limits and keeps their own topic', () => {
  assertProperty(
    'AWS IoT policy size',
    fc.property(fc.integer({ min: 0, max: 400 }), (rooms) => {
      const result = connect('monitor', 900, rooms);
      expect(result.isAuthenticated).toBe(true);
      const policies = (result.policyDocuments ?? []) as Policy[];
      expect(policies.length).toBeGreaterThanOrEqual(1);
      expect(policies.length).toBeLessThanOrEqual(MAX_POLICY_DOCUMENTS);
      for (const policy of policies) {
        expect(JSON.stringify(policy).length).toBeLessThanOrEqual(
          MAX_POLICY_CHARACTERS
        );
      }
      expect(granted(policies, 'iot:Connect')).toHaveLength(1);
      expect(granted(policies, 'iot:Subscribe')).toContain(
        'arn:aws:iot:us-east-1:123456789012:topicfilter/user/monitor'
      );
      // Rooms are granted in token order; none is granted twice or half.
      const subscribe = granted(policies, 'iot:Subscribe');
      expect(new Set(subscribe).size).toBe(subscribe.length);
      expect(granted(policies, 'iot:Receive')).toHaveLength(subscribe.length);
      expect(granted(policies, 'iot:Publish')).toHaveLength(subscribe.length);
    })
  );
});

test('a person in sixty rooms keeps live updates for all of them', () => {
  const policies = (connect('monitor', 900, 60).policyDocuments ??
    []) as Policy[];
  expect(granted(policies, 'iot:Subscribe')).toHaveLength(61);
});
