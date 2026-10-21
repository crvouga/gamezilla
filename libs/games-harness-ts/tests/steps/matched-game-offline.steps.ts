/**
 * A matched game's person whose device was offline while their opponent
 * acted, whichever game it is: what the device finds once it is back.
 */

import { expect } from 'bun:test';
import { resignation } from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { Given } from '@libs/harness-ts/define';
import { firstMoves, pairedAt } from './matched-game';
import { deviceOffline } from './matched-game-connection';

Given(
  "{actor}'s phone was offline when {actor} resigned the matched game after their first moves",
  async (w, offline: string, opponent: string) => {
    await pairedAt(w, offline, opponent);
    await firstMoves(w);
    await deviceOffline(w, offline);
    expect((await resignation(w, opponent)).result.ok).toBe(true);
  }
);
