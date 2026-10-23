/**
 * Private setups in a matched game: two people paired with both setups
 * still to choose, each choosing theirs once and for good, the clocks that
 * run while they choose, and what each move reveals to the other person and
 * a watcher.
 */

import { expect } from 'bun:test';
import {
  bothBoards,
  viewerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import { shownBoardPosition } from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { chooseMatchedPrivateSetup } from '@libs/game-session-harness-ts/matched-game-private-setup';
import { Given, Then, When } from '@libs/harness-ts/define';
import { daily } from './finding-an-opponent-world';
import { firstMoves, told } from './matched-game';
import { deviceOffline } from './matched-game-connection';
import {
  chosenSetup,
  pairedChoosingSetups,
  revealedAfter,
} from './private-setup-world';

const SECOND_MS = 1000;

Given(
  '{actor} has the first side against {actor} in a {word} matched game awaiting both private setups',
  async (w, first: string, second: string, clock: string) =>
    pairedChoosingSetups(w, first, second, clock)
);
Given(
  '{actor} has the first side against {actor} in a daily game at {int} day(s) per move awaiting both private setups',
  async (w, first: string, second: string, days: number) =>
    pairedChoosingSetups(w, first, second, daily(days))
);
Given('{actor} has chosen his/her private setup', async (w, actor: string) =>
  chosenSetup(w, actor)
);
Given(
  '{actor} and {actor} have chosen their private setups',
  async (w, first: string, second: string) => {
    await chosenSetup(w, first);
    await chosenSetup(w, second);
  }
);
Given(
  '{actor} and {actor} chose their private setups {int} seconds after they were paired',
  async (w, first: string, second: string, seconds: number) => {
    await w.s.apply(passMultiplayerTime, seconds * SECOND_MS);
    await chosenSetup(w, first);
    await chosenSetup(w, second);
  }
);
Given(
  '{actor} and {actor} have chosen their private setups and made their first moves',
  async (w, first: string, second: string) => {
    await chosenSetup(w, first);
    await chosenSetup(w, second);
    await firstMoves(w);
  }
);
Given(
  '{actor} is back online after her offline choice was refused',
  async (w, actor: string) => {
    await deviceOffline(w, actor);
    await w.s.apply(chooseMatchedPrivateSetup, actor);
    await told(w, actor, 'OFFLINE');
    await w.s.apply(setMultiplayerConnection, actor, true);
  }
);

When('{actor} chooses his/her private setup', async (w, actor: string) => {
  await w.s.apply(chooseMatchedPrivateSetup, actor);
});

Then(
  '{actor} is told his/her chosen private setup is final',
  async (w, actor: string) => told(w, actor, 'CHESS_SETUP_CHOSEN')
);
Then(
  "{actor} and {actor} see what {actor}'s first move revealed",
  async (w, first: string, second: string) => {
    await bothBoards(w, (game) => game.revision === 1);
    for (const viewer of [first, second])
      expect(
        await w.s.until((s) => shownBoardPosition(s, viewerOf(w, viewer)), {
          pred: (position) => position === revealedAfter(w, 1),
        })
      ).toBe(revealedAfter(w, 1));
  }
);
