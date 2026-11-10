import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness-ts/define';
import {
  dailyScheduleBegins,
  dailyScheduleEnds,
  givenNotOnline,
  givenSyntheticUsersOnline,
  syntheticUserOnline,
  syntheticUsersOnline,
} from '@libs/synthetic-population-harness-ts/daily-rhythm-actions';
import { stayedOnlineToFinish } from '@libs/synthetic-population-harness-ts/live-synthetic-users';

const MINUTE_MS = 60_000;
/** A deployed worker's pace: how often anything about being online changes. */
const BEAT_MS = 5_000;

Given('{int} Synthetic Users are online now', async (w, count: number) => {
  await w.s.apply(givenSyntheticUsersOnline, count);
});
Given(
  '{int} Synthetic Users are online now, none of them playing',
  async (w, count: number) => {
    await w.s.apply(givenSyntheticUsersOnline, count);
  }
);
Given(
  'the Synthetic User {string} is not online now',
  async (w, name: string) => {
    await w.s.apply(givenNotOnline, name);
    expect(await w.s.read(syntheticUserOnline, name)).toBe(false);
  }
);
When("{string}'s daily schedule begins", async (w, name: string) => {
  await w.s.apply(dailyScheduleBegins, name);
});
When("{string}'s daily schedule is over", async (w, name: string) => {
  await w.s.apply(dailyScheduleEnds, name);
});
Then(
  '{string} is online now within {int} minutes',
  async (w, name: string, minutes: number) => {
    await w.s.until((s) => syntheticUserOnline(s, name), {
      pred: Boolean,
      maxMs: minutes * MINUTE_MS,
      stepMs: BEAT_MS,
    });
  }
);
Then(
  '{string} is still not online now {int} minutes later',
  async (w, name: string, minutes: number) => {
    await w.s.never((s) => syntheticUserOnline(s, name), {
      forMs: minutes * MINUTE_MS,
      stepMs: BEAT_MS,
      pred: Boolean,
    });
  }
);
Then(
  '{string} is not online now within {int} minutes',
  async (w, name: string, minutes: number) => {
    await w.s.until((s) => syntheticUserOnline(s, name), {
      pred: (online) => !online,
      maxMs: minutes * MINUTE_MS,
      stepMs: BEAT_MS,
    });
  }
);
Then(
  '{string} is still online now while it finishes its ongoing game',
  async (w, name: string) => {
    expect(await w.s.read(stayedOnlineToFinish, name)).toBe(true);
  }
);
Then(
  '{int} Synthetic Users are online now within {int} minutes',
  async (w, count: number, minutes: number) => {
    await w.s.until(syntheticUsersOnline, {
      pred: (online) => online === count,
      maxMs: minutes * MINUTE_MS,
      stepMs: BEAT_MS,
    });
  }
);
