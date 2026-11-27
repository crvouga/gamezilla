import { expect, test } from 'bun:test';
import {
  blockPerson,
  openPersonFromSearch,
} from '@libs/friends-harness-ts/person-actions';
import { sharedBlockStored } from '@libs/friends-harness-ts/relationship-reads';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import {
  claimActorUsername,
  signInWithGoogle,
} from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { recordingRun } from '@libs/harness-ts/spec-world';
import '@libs/profile-harness-ts/profile.steps';
import { readProfileTabUsername } from '@libs/profile-harness-ts/profile-ui-reads';
import { matchStep } from '@pkgs/gherkin-shared-ts/registry';
import { openHarness } from './open-friends-harness';

function withStackTag(s: ProductHarness): ProductHarness {
  const ports = {
    ...s.session.ports,
    http: { kind: 'stack', accountTag: '995ee9d9' },
  };
  return { ...s, session: { ...s.session, ports } };
}

// regression: block-scoped-username
test('Bob claims his shared-stack name once and Alice blocks that profile', async () => {
  await using s = await openHarness();
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(signInWithGoogle, 'bob');
  const alice = await s.read(accountIdOf, 'alice');
  const bob = await s.read(accountIdOf, 'bob');
  if (alice === null || bob === null)
    throw new Error('Both accounts must be signed in');

  await s.apply(
    scenarioAction({
      name: 'claimBobOnSharedStack',
      act: (surface) => claimActorUsername.act(withStackTag(surface), 'bob'),
    })
  );
  await s.apply(backToTabs, 'bob');
  expect(await s.read(readProfileTabUsername, 'bob')).toBe('bob_995ee9d9');

  const calls: string[] = [];
  const run = recordingRun(
    {
      ...s,
      read: (read, ...args) =>
        s.read((surface) => read(withStackTag(surface), ...args)),
    },
    calls
  );
  const step = matchStep("Bob's username is @bob");
  if (step.kind !== 'match') throw new Error(step.kind);
  const memo = new Map<string, unknown>();
  await step.definition.body({ s: run, memo }, ...step.args);
  expect(memo.get('username:bob')).toBe('bob_995ee9d9');
  expect(calls.some((call) => call.startsWith('apply submitUsername'))).toBe(
    false
  );

  await s.apply(
    scenarioAction({
      name: 'blockBobOnSharedStack',
      act: async (surface) => {
        const scoped = withStackTag(surface);
        await Promise.resolve(openPersonFromSearch.act(scoped, 'alice', 'bob'));
        await Promise.resolve(blockPerson.act(scoped, 'alice', 'bob'));
      },
    })
  );
  expect(
    await s.until((surface) => sharedBlockStored(surface, alice, bob))
  ).toBe(true);
});
