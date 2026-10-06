import { expect } from 'bun:test';
import { showChessStatsScreen } from '@libs/chess-puzzle-harness/chess-actions';
import {
  isGameLogEmpty,
  readStatsElo,
  readStatsPlayed,
  readStatsRatingLabel,
  readStatsSolved,
} from '@libs/chess-puzzle-harness/chess-puzzle-ui';
import { Given, Then } from '@libs/harness/define';
import { localAccountIdOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import { deviceShowsSignedIn } from '@libs/harness/sign-in-state-reads';
import { recall, signedInAccountKey } from '@libs/harness/spec-world';
import { SECOND_MS } from './puzzle-world';

/**
 * How long a device back online may take to learn its account was deleted
 * when a step names no time: as long as account deletion gives a returning
 * device to be signed out (150 seconds).
 */
const RECONNECT_MS = 150_000;

Given(
  '{actor} had a settled puzzle rating on the deleted account',
  async (w) => {
    expect(recall(w, 'deleted-puzzle-rating')).toBeGreaterThan(1500);
    expect(recall(w, 'deleted-puzzle-label')).not.toContain('?');
  }
);
Given(
  "{actor}'s deleted account had solved puzzles in its game log",
  async (w) => {
    expect(recall(w, 'deleted-puzzle-solved')).toBeGreaterThan(0);
  }
);
Given("{actor}'s deleted account had saved a custom feed target", async (w) => {
  expect(recall(w, 'deleted-feed-target')).toMatchObject({ mode: 'custom' });
});

Then(
  "{actor}'s other device cannot show the deleted account's puzzle rating, game log or stats within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    const device = otherDevice(actor);
    await w.s.apply(focusActor, device);
    await w.s.apply(showChessStatsScreen, device);
    // A new solver's stats: no rating earned, no attempt logged or counted.
    await w.s.until(
      async (surf) => ({
        label: await readStatsRatingLabel(surf, device),
        played: await readStatsPlayed(surf, device),
        empty: await isGameLogEmpty(surf, device),
      }),
      {
        maxMs: seconds * SECOND_MS,
        pred: (shown) =>
          shown.label === '1500?' && shown.played === 0 && shown.empty,
      }
    );
  }
);

Then(
  "{actor}'s puzzle rating is 1500 and has not settled",
  async (w, actor: Actor) => {
    await w.s.apply(showChessStatsScreen, actor);
    expect(await w.s.read(readStatsElo, actor)).toBe(1500);
    expect(await w.s.read(readStatsRatingLabel, actor)).toContain('?');
  }
);
Then(
  "{actor}'s game log cannot show the deleted account's attempts",
  async (w, actor: Actor) => {
    // The device first stops being the deleted account (signed out, or
    // signed in to another one): a device back online learns the account is
    // gone when it next checks its session, within the time deletion allows.
    const deleted = recall(w, signedInAccountKey(actor));
    await w.s.until(
      async (surf) =>
        (await deviceShowsSignedIn(surf, actor))
          ? await localAccountIdOf(surf, actor)
          : 'signed out',
      {
        maxMs: RECONNECT_MS,
        pred: (account) => account !== null && account !== deleted,
      }
    );
    await w.s.apply(focusActor, actor);
    await w.s.apply(showChessStatsScreen, actor);
    expect(await w.s.read(isGameLogEmpty, actor)).toBe(true);
  }
);
Then("{actor}'s stats show 0 played and 0 solved", async (w, actor: Actor) => {
  await w.s.apply(showChessStatsScreen, actor);
  expect(await w.s.read(readStatsPlayed, actor)).toBe(0);
  expect(await w.s.read(readStatsSolved, actor)).toBe(0);
});
