import { expect, test } from 'bun:test';
import { buildAppAuthContext } from '@libs/auth-shared-ts/auth-context';
import { DEVICE, resolveWith } from './query-auth-fixture';

// regression: database-conflict-expires-valid-session
test('a database serialization failure never becomes an expired-session verdict', async () => {
  const failure = Object.assign(
    new Error('could not serialize access due to concurrent update'),
    { code: '40001' }
  );
  await expect(
    resolveWith(async () => {
      throw failure;
    })
  ).rejects.toBe(failure);
});

test('an unavailable authentication store remains an infrastructure failure', async () => {
  const failure = new Error('connection lost');
  await expect(
    resolveWith(async () => {
      throw failure;
    })
  ).rejects.toBe(failure);
});

test('missing credentials and deleted accounts remain authentication refusals', async () => {
  const missing = await resolveWith(async () => ({}));
  expect(missing).toEqual({ error: 'auth', reason: 'expired' });
  const deleted = await resolveWith(async () => ({ accountDeleted: true }));
  expect(deleted).toMatchObject({ error: 'auth', reason: 'revoked' });
});

test('a valid resolved account retains its actor and device', async () => {
  const account = '31c02d7e-de4f-4a64-a4fe-402318f44717';
  const resolved = await resolveWith(async () =>
    buildAppAuthContext({
      accountId: account,
      myId: account,
      deviceId: DEVICE,
      isAnon: false,
    })
  );
  expect(resolved).toMatchObject({
    accountId: account,
    actorId: account,
    deviceId: DEVICE,
  });
});

test.each(['', 'not-a-device'])(
  'malformed device %j is refused before querying authentication',
  async (device) => {
    let calls = 0;
    const result = await resolveWith(
      async () => {
        calls++;
        return {};
      },
      {
        authorization: 'Bearer token',
        'x-anon-id': device,
      }
    );
    expect(result).toEqual({ error: 'auth', reason: 'expired' });
    expect(calls).toBe(0);
  }
);
