import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { authorize } from '../tofu/modules/pubsub/authorizer/index.mjs';

const config = {
  tokenSecret: 'test-secret',
  region: 'us-east-1',
  accountId: '123456789012',
  nowSec: 1_792_085_280,
};

function connect(subject: string, remaining = 900) {
  const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: subject,
      exp: config.nowSec + remaining,
      acl: [
        { permission: 'allow', action: 'subscribe', topic: `user:${subject}` },
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
