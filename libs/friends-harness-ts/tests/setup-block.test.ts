import { expect, mock, test } from 'bun:test';
import { setupBlock } from '@libs/friends-harness-ts/setup-block';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { DeviceMutations } from '@libs/harness-ts/webview-mutations';

function browserBlocker(mutations: DeviceMutations): ProductHarness {
  return {
    actors: new Map([['bob', { mutations }]]),
    harness: {
      serverSql: {
        sqlClient: { query: async () => [{ user_id: 'carol-account' }] },
      },
      spawnClient: async () => ({
        env: { secureStorage: { getValue: () => null } },
      }),
    },
    session: {
      ports: {
        http: { kind: 'stack', accountTag: 'abcddcba' },
        createId: () => '00000000-0000-4000-8000-000000000001',
      },
      scheduler: { virtual: true, starvedAdvances: () => 0 },
      advanceTime: async () => {},
      waitForIdle: async () => {},
    },
  } as unknown as ProductHarness;
}

// regression: block-from-launched-device
test("Bob blocks Carol from his launched device before claiming Alice's open side", async () => {
  const send = mock<DeviceMutations['send']>(async () => 'bob-ticket');
  const verdict = mock<DeviceMutations['verdict']>()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ result: { ok: true, mutationId: 'block' } });
  await Promise.resolve(
    setupBlock.act(browserBlocker({ send, verdict }), 'bob', 'carol')
  );
  expect(send.mock.calls).toEqual([
    [
      'blockUser',
      {
        userId: 'carol-account',
        blockId: 'abcddcba-0000-4000-8000-000000000001',
      },
    ],
  ]);
  expect(verdict.mock.calls).toEqual([['bob-ticket'], ['bob-ticket']]);
});

test("a refused block on Bob's device fails the precondition", async () => {
  const failure = { rule: 'friends', code: 'refused', message: 'refused' };
  const device = browserBlocker({
    send: async () => 'bob-ticket',
    verdict: async () => ({ result: { ok: false, failures: [failure] } }),
  });
  await expect(setupBlock.act(device, 'bob', 'carol')).rejects.toThrow(
    'bob could not block carol'
  );
});
