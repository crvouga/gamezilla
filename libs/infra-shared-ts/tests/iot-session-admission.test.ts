import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { admitIotClient } from '../src/iot-session-admission';

const SECRET = 'stack-jwt-secret';
const NOW = 1_792_085_280;

function token(
  topics: readonly string[],
  options: { secret?: string; remaining?: number } = {}
): string {
  const header = Buffer.from('{"alg":"HS256"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'actor-1',
      exp: NOW + (options.remaining ?? 900),
      acl: topics.flatMap((topic) =>
        (['subscribe', 'publish'] as const).map((action) => ({
          permission: 'allow',
          action,
          topic,
        }))
      ),
    })
  ).toString('base64url');
  const signature = createHmac('sha256', options.secret ?? SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function admit(password: string | undefined, clientId = 'device-1') {
  return admitIotClient({
    tokenSecret: SECRET,
    nowSec: NOW,
    clientId,
    password,
  });
}

// regression: ungranted-system-topic-passes-pull-request
test('a device may use the topics its token grants and no others', () => {
  const admission = admit(token(['user:actor-1', 'system:client_config']));
  if (admission.kind !== 'limited') throw new Error('expected a session');
  expect(admission.access.canSubscribe('user:actor-1')).toBe(true);
  expect(admission.access.canSubscribe('system:client_config')).toBe(true);
  expect(admission.access.canPublish('user:actor-1')).toBe(true);
  expect(admission.access.canReceive('user:actor-1')).toBe(true);
  // The catalog topic no sub granted: what AWS IoT refused in Release.
  expect(admission.access.canSubscribe('system:chess_puzzles')).toBe(false);
  expect(admission.access.canPublish('system:chess_puzzles')).toBe(false);
  expect(admission.access.canReceive('system:chess_puzzles')).toBe(false);
  expect(admission.access.canSubscribe('user:actor-2')).toBe(false);
});

test('a topic filter is granted only as written, never as a wildcard', () => {
  const admission = admit(token(['room:space-1']));
  if (admission.kind !== 'limited') throw new Error('expected a session');
  expect(admission.access.canSubscribe('room:space-1')).toBe(true);
  expect(admission.access.canSubscribe('room:+')).toBe(false);
  expect(admission.access.canSubscribe('#')).toBe(false);
});

test('a token IoT would not accept is refused at connect', () => {
  expect(admit(undefined).kind).toBe('refused');
  expect(admit('not-a-token').kind).toBe('refused');
  expect(admit(token(['user:actor-1'], { secret: 'other' })).kind).toBe(
    'refused'
  );
  expect(admit(token(['user:actor-1'], { remaining: 10 })).kind).toBe(
    'refused'
  );
  expect(admit(token(['user:actor-1']), 'a:b').kind).toBe('refused');
});

test('the password may arrive base64-encoded, as IoT hands it over', () => {
  const encoded = Buffer.from(token(['user:actor-1'])).toString('base64');
  expect(admit(encoded).kind).toBe('limited');
});
