import { Given, When } from '@libs/harness-ts/define';
import { dailyScheduleEnds } from '@libs/synthetic-population-harness-ts/daily-rhythm-actions';
import { givenSyntheticUser } from '@libs/synthetic-population-harness-ts/synthetic-user-fixtures';

// Synthetic Users, borrowed from the Synthetic Population, as the User
// Observatory sees them.
Given(
  'the Synthetic User {string} has an ongoing {string} game',
  async (w, name: string, game: string) => {
    await w.s.apply(givenSyntheticUser, name, true, game);
  }
);
Given('the Synthetic User {string} is available', async (w, name: string) => {
  await w.s.apply(givenSyntheticUser, name, false);
});
When("{string}'s daily schedule is over", async (w, name: string) => {
  await w.s.apply(dailyScheduleEnds, name);
});
