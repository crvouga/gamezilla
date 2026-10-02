import { expect } from 'bun:test';
import {
  confirmDeletion,
  privacyTimePasses,
  proveAccount,
} from '@libs/account-privacy/harness/privacy-actions';
import { privacyStatus } from '@libs/account-privacy/harness/privacy-reads';
import {
  ordinaryProfileData,
  preserveProfileForLegalObligation,
  retainedForPurpose,
} from '@libs/account-privacy/harness/retention';
import { signedInAccountOf } from '@libs/harness';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import {
  type HarnessWorld,
  recall,
  remember,
  signedInAccountKey,
} from '@libs/harness/spec/world';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile/harness/profile-actions';
import { profileVisibleToPeople } from '@libs/profile/harness/profile-visibility';

async function personalAccount(w: HarnessWorld, actor: Actor) {
  await w.s.apply(proveAccount, actor);
  const accountId = await w.s.read(signedInAccountOf, actor);
  remember(w, signedInAccountKey(actor), accountId);
  await w.s.apply(openProfileEdit, actor);
  await w.s.apply(setUsername, actor, 'retained_alice');
  remember(
    w,
    'personal-data',
    await w.s.read(profileVisibleToPeople, String(accountId))
  );
}

Given(
  '{actor} confirmed account deletion 29 days ago',
  async (w, actor: Actor) => {
    await personalAccount(w, actor);
    await w.s.apply(confirmDeletion, actor);
    await w.s.apply(privacyTimePasses, 29 * 86_400_000);
  }
);
When('1 day passes', async (w) => {
  await w.s.apply(privacyTimePasses, 86_400_000);
});
Then(
  "the team has erased {actor}'s ordinary personal data",
  async (w, actor: Actor) => {
    const accountId = String(recall(w, signedInAccountKey(actor)));
    expect((await w.s.read(privacyStatus, accountId)).deletion).toBe('Deleted');
    expect(await w.s.read(ordinaryProfileData, accountId)).toEqual([
      { username: '', avatar_config: null },
    ]);
  }
);
Then('only disclosed retention exceptions can remain', async (w) => {
  const accountId = String(recall(w, signedInAccountKey('alice')));
  expect(
    await w.s.read(retainedForPurpose, accountId, 'ordinary account use')
  ).toEqual([]);
});
When(
  "{actor} looks for {actor}'s profile",
  async (w, _observer: Actor, person: Actor) => {
    remember(
      w,
      'profile-found',
      await w.s.read(
        profileVisibleToPeople,
        String(recall(w, signedInAccountKey(person)))
      )
    );
  }
);
Then(
  '{actor} cannot find the deleted profile because {actor} deleted the account',
  async (w) => {
    expect(recall(w, 'profile-found')).toBeNull();
  }
);
Given(
  "{actor}'s deleted account has personal data retained for a specific legal preservation obligation",
  async (w, actor: Actor) => {
    await personalAccount(w, actor);
    await w.s.apply(
      preserveProfileForLegalObligation,
      String(recall(w, signedInAccountKey(actor)))
    );
    await w.s.apply(confirmDeletion, actor);
    await w.s.apply(privacyTimePasses, 30 * 86_400_000);
  }
);
When('the team reviews that retained personal data', async (w) => {
  const rows = await w.s.read(
    retainedForPurpose,
    String(recall(w, signedInAccountKey('alice'))),
    'legal preservation'
  );
  expect(rows).toHaveLength(1);
});
Then(
  'the team cannot use it to restore a profile or promote the product to {actor}',
  async (w, actor: Actor) => {
    const accountId = String(recall(w, signedInAccountKey(actor)));
    expect(await w.s.read(profileVisibleToPeople, accountId)).toBeNull();
    expect(
      await w.s.read(retainedForPurpose, accountId, 'ordinary account use')
    ).toEqual([]);
    expect(
      await w.s.read(retainedForPurpose, accountId, 'product promotion')
    ).toEqual([]);
  }
);
Given(
  '{actor} has an account with personal data and has not asked for account deletion',
  personalAccount
);
Given('{actor} has not used the app for 2 years', async (w) => {
  await w.s.apply(privacyTimePasses, 2 * 365 * 86_400_000);
});
Then(
  '{actor} has the same account and retained personal data',
  async (w, actor: Actor) => {
    expect<unknown>(await w.s.read(signedInAccountOf, actor)).toBe(
      recall(w, signedInAccountKey(actor))
    );
    expect<unknown>(
      await w.s.read(
        profileVisibleToPeople,
        String(recall(w, signedInAccountKey(actor)))
      )
    ).toEqual(recall(w, 'personal-data'));
  }
);
