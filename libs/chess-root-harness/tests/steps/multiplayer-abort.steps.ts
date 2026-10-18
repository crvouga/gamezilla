import { expect } from 'bun:test';
import { bothBoards } from '@libs/game-matchmaking-harness/matched-game-world';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness/multiplayer-time';
import { Then, When } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';

const SECOND_MS = 1000;

function passing(w: HarnessWorld, seconds: number) {
  return w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
}

When('{int} seconds pass in multiplayer chess', passing);

Then('the multiplayer game is still unfinished', async (w) => {
  expect((await bothBoards(w)).outcome).toBe('ongoing');
});
