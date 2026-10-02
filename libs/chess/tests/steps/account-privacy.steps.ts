import { expect } from 'bun:test';
import { showChessStatsScreen } from '@libs/chess/harness/chess-actions';
import {
  isGameLogEmpty,
  readStatsElo,
  readStatsPlayed,
  readStatsRatingLabel,
  readStatsSolved,
} from '@libs/chess/harness/chess-puzzle-ui';
import { type Actor, Given, Then } from '@libs/harness/spec/define';
import { recall } from '@libs/harness/spec/world';

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
    await w.s.apply(showChessStatsScreen, actor);
    expect(await w.s.read(isGameLogEmpty, actor)).toBe(true);
  }
);
Then("{actor}'s stats show 0 played and 0 solved", async (w, actor: Actor) => {
  await w.s.apply(showChessStatsScreen, actor);
  expect(await w.s.read(readStatsPlayed, actor)).toBe(0);
  expect(await w.s.read(readStatsSolved, actor)).toBe(0);
});
