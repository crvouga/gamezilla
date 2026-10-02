import { expect } from 'bun:test';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import {
  followTrail,
  prepareRecoveryCopy,
  recordTrail,
  recoverApp,
  recoveredAccountProfile,
  recoveredAccountUsable,
  recoveredPersonalData,
  trailPreservation,
  trailRead,
} from '@libs/runtime/harness/privacy-retention';

Given(
  "a recovery copy has {actor}'s active account and personal data",
  async (w, actor: Actor) => {
    await w.s.apply(prepareRecoveryCopy, actor, false);
  }
);
Given(
  "a recovery copy contains {actor}'s personal data from before confirmed account deletion",
  async (w, actor: Actor) => {
    await w.s.apply(prepareRecoveryCopy, actor, true);
  }
);
When('the team recovers the app from that recovery copy', async (w) => {
  await w.s.apply(recoverApp);
});
Then('{actor} can use the recovered personal data', async (w, actor: Actor) => {
  expect((await w.s.read(recoveredPersonalData, actor))?.username).toBe(
    `saved_${actor}`
  );
});
Then(
  "{actor}'s deleted account cannot become usable again",
  async (w, _actor: Actor) => {
    expect(await w.s.read(recoveredAccountUsable)).toBe(false);
  }
);
Then(
  "{actor}'s ordinary personal data cannot return to use",
  async (w, _actor: Actor) => {
    expect(await w.s.read(recoveredAccountProfile)).toBeNull();
  }
);
Given(
  "{actor}'s trail was recorded {int} days ago",
  async (w, actor: Actor, days: number) => {
    await w.s.apply(recordTrail, actor, days);
  }
);
Given('no specific legal preservation obligation applies to it', async (w) => {
  expect(await w.s.read(trailPreservation, 'alice')).toBeNull();
});
When('the team follows that trail', async (w) => {
  await w.s.apply(followTrail, 'alice');
});
Then('the team can read that trail', async (w) => {
  expect(await w.s.read(trailRead)).toEqual({
    event: 'opened the app',
    person: 'alice',
  });
});
Then(
  'the team cannot read that trail because its retention period has expired',
  async (w) => {
    expect(await w.s.read(trailRead)).toBeNull();
  }
);
