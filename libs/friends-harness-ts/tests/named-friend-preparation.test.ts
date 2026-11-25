import { expect, test } from 'bun:test';
import {
  actorUsernameOf,
  prepareNamedFriend,
  setupFriendRequest,
} from '@libs/friends-harness-ts/setup-friend-request';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { createHarnessTeamRules } from '@libs/harness-ts/team-rules';
import { readProfileTabUsername } from '@libs/profile-harness-ts/profile-ui-reads';

test('an existing offline friend name requires no setup mutation', async () => {
  // regression: named-friend-offline-profile-read
  const applied: string[] = [];
  const harness = {
    read: async (read: unknown, actor: string) => {
      if (read === signedInAccountOf) return 'alice-account';
      if (read === readProfileTabUsername) return actor;
      // Outside a shared stack an actor claims their bare name.
      if (read === actorUsernameOf) return actor;
      // The profile control is absent on the current spaces tab.
      return null;
    },
    apply: async (action: { readonly name: string }) => {
      applied.push(action.name);
      if (action !== backToTabs)
        throw new Error('Offline Alice cannot change her existing username');
    },
  } as Parameters<typeof prepareNamedFriend>[0];
  await prepareNamedFriend(harness, 'alice');
  expect(applied).toEqual(['backToTabs']);
});

// regression: friend-request-before-shared-username
test("the sender's and recipient's new names are shared before search and the inbox use them", async () => {
  const shared = new Map<string, string>();
  let device = '';
  let waiting = false;
  const s = {
    actors: new Map(
      ['alice', 'bob'].map((actor) => [
        actor,
        {
          memberId: async () => actor,
        },
      ])
    ),
    harness: {
      serverSql: {
        sqlClient: { query: async () => [{ username: shared.get(device) }] },
      },
      teamRules: createHarnessTeamRules({ now: () => 0 }),
    },
  } as unknown as ProductHarness;
  const run = {
    read: async (read: unknown, actor: string) => {
      if (read === signedInAccountOf) return actor;
      if (read === actorUsernameOf) return actor + '_03a863c3';
      return null;
    },
    apply: async (action: { name: string }, actor: string) => {
      if (action.name === 'setUsername') device = actor;
      if (action.name === 'searchUsername') {
        expect([...shared.keys()]).toEqual(['alice', 'bob']);
        waiting = true;
      }
    },
    until: async (
      read: (world: ProductHarness) => Promise<string>,
      options?: { pred: (value: string) => boolean }
    ) => {
      if (waiting) return;
      expect(options!.pred(await read(s))).toBe(false);
      shared.set(device, device + '_03a863c3');
      expect(options!.pred(await read(s))).toBe(true);
    },
  } as unknown as Parameters<typeof setupFriendRequest>[0];
  await setupFriendRequest(run, 'alice', 'bob');
  expect(waiting).toBe(true);
});
