import { expect, test } from 'bun:test';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { backToTabs } from '@libs/harness/shell-actions';
import { signedInAccountOf } from '@libs/harness/identity';
import { readProfileTabUsername } from '@libs/profile-harness/profile-ui-reads';

test('an existing offline friend name requires no setup mutation', async () => {
  // regression: named-friend-offline-profile-read
  const applied: string[] = [];
  const harness = {
    read: async (read: unknown, actor: string) => {
      if (read === signedInAccountOf) return 'alice-account';
      if (read === readProfileTabUsername) return actor;
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
