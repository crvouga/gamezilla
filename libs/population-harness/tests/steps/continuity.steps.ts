import { expect } from 'bun:test';
import { Given, Then, When } from '@libs/harness/define';
import {
  givenFinishedSyntheticGame,
  reopenSyntheticApp,
  syntheticContinuity,
  syntheticGameShown,
  syntheticUsername,
} from '@libs/population-harness/continuity-actions';

type Continuity = Awaited<ReturnType<typeof syntheticContinuity>>;
Given(
  'the Synthetic User {string} has a finished multiplayer game',
  async (w, name: string) => {
    await w.s.apply(givenFinishedSyntheticGame, name);
  }
);
When(
  'the Synthetic User {string} closes and reopens the app',
  async (w, _name: string) => {
    const before = await w.s.read(syntheticContinuity);
    w.memo.set('population:continuity', before);
    await w.s.apply(reopenSyntheticApp, before.board.gameId);
  }
);
Then(
  'the Synthetic User {string} keeps its account and username',
  async (w, _name: string) => {
    const before = w.memo.get('population:continuity') as Continuity;
    const after = await w.s.read(syntheticContinuity);
    expect(after.account).toBe(before.account);
    expect(after.account).not.toBeNull();
    expect(await w.s.read(syntheticUsername)).toBe('cedar');
  }
);
Then(
  'the Synthetic User {string} remains available',
  async (w, _name: string) => {
    expect((await w.s.read(syntheticContinuity)).account).not.toBeNull();
  }
);
Then(
  'the Synthetic User {string} continues its same multiplayer game',
  async (w, _name: string) => {
    const before = w.memo.get('population:continuity') as Continuity;
    const after = await w.s.read(syntheticGameShown);
    expect(after.board.gameId).toBe(before.board.gameId);
    expect(after.board.gameId).not.toBeNull();
    expect(after.board.outcome).toBe('ongoing');
  }
);
Then(
  'the Synthetic User {string} keeps its finished multiplayer result',
  async (w, _name: string) => {
    const before = w.memo.get('population:continuity') as Continuity;
    const after = await w.s.read(syntheticGameShown);
    expect(after.board.gameId).toBe(before.board.gameId);
    expect(after.board.announcement).toBe(before.board.announcement);
    expect(after.board.outcome).not.toBe('ongoing');
  }
);
