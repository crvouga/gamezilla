import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import {
  givenFinishedSyntheticGame,
  reopenSyntheticApp,
  syntheticAvailable,
  syntheticContinuity,
  syntheticGameShown,
  syntheticUsername,
} from '@libs/synthetic-population-harness/continuity-actions';
import { recallContinuity, rememberContinuity } from './continuity-memo';

Given(
  'the Synthetic User {string} has a finished {string} game',
  async (w, name: string, game: string) => {
    // regression: finished-game-fixture-observes-unsettled-result
    // regression: synthetic-game-fixture-runs-before-position
    // regression: multiplayer-snapshot-one-millisecond-focus
    await w.s.apply(givenFinishedSyntheticGame, name, game);
  }
);
When(
  'the Synthetic User {string} closes and reopens the app',
  async (w, _name: string) => {
    const before = await rememberContinuity(w);
    await w.s.apply(reopenSyntheticApp, before.board.gameId);
  }
);
Then(
  'the Synthetic User {string} keeps its account and username',
  async (w, _name: string) => {
    // regression: synthetic-population-browser-device-fencing
    // regression: browser-reopening-deletes-device-storage
    const before = recallContinuity(w);
    const after = await w.s.read(syntheticContinuity);
    expect(after.account).toBe(before.account);
    expect(after.account).not.toBeNull();
    expect(await w.s.read(syntheticUsername)).toBe('cedar');
  }
);
Then(
  'the Synthetic User {string} remains available',
  async (w, _name: string) => {
    expect(await w.s.read(syntheticAvailable)).toBe(true);
  }
);
Then(
  'the Synthetic User {string} continues its same multiplayer game',
  async (w, _name: string) => {
    const before = recallContinuity(w);
    const after = await w.s.read(syntheticGameShown);
    expect(after.board.gameId).toBe(before.board.gameId);
    expect(after.board.gameId).not.toBeNull();
    expect(after.board.outcome).toBe('ongoing');
  }
);
Then(
  'the Synthetic User {string} keeps its finished multiplayer result',
  async (w, _name: string) => {
    const before = recallContinuity(w);
    const after = await w.s.read(syntheticGameShown);
    expect(after.board.gameId).toBe(before.board.gameId);
    expect(after.board.announcement).toBe(before.board.announcement);
    expect(after.board.outcome).not.toBe('ongoing');
  }
);
