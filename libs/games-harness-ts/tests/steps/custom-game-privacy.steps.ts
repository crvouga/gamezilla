/**
 * Account deletion and personal-data exports for custom games. The world's
 * `beforeAccountDeletion` (in `index.ts`) gives a deleted account a custom
 * game of the run's game before the deletion completes.
 */

import { expect } from 'bun:test';
import { readExportedCustomGames } from '@libs/game-session-harness-ts/custom-game-export';
import { recordedLine } from '@libs/game-session-harness-ts/played-rules';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { Given, Then } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { recall, remember } from '@libs/harness-ts/spec-world';
import { openSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { seesNoCustomGame, tryToWatch } from './custom-game-access.steps';
import { current } from './custom-game-set-up-world';
import {
  before,
  gameOf,
  rememberCustomGame,
  setupCustomGame,
  spaceLinkOf,
} from './game-world';

const DELETED_GAME = 'deleted-custom-game-id';
const DELETED_LINK = 'deleted-custom-game-link';

/** `actor`, whose account is about to be deleted, has a custom game set up. */
export async function customGameBeforeDeletion(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await setupCustomGame(w, {
    host: actor,
    first: actor,
    second: 'open',
    ready: false,
    active: false,
  });
  await rememberCustomGame(w);
  remember(w, DELETED_GAME, (await current(w)).id);
  remember(w, DELETED_LINK, await spaceLinkOf(w));
}

Given("{actor}'s deleted account had a custom game", async (w) => {
  expect(recall(w, DELETED_GAME)).toBeString();
  expect(recall(w, DELETED_LINK)).toBeString();
});

Then("{actor}'s space has not ended", async (w, actor: string) => {
  await w.s.apply(openSpaceLink, actor, await spaceLinkOf(w));
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
});
Then(
  "{actor} cannot see the deleted account's custom game",
  async (w, actor: string) => {
    await tryToWatch(w, actor, String(recall(w, DELETED_LINK)));
    await seesNoCustomGame(w, actor);
  }
);
// regression: custom-game-personal-export-omits-games
Then(
  "{actor}'s personal-data export includes the custom game's choices, moves and result",
  async (w, actor: string) => {
    const game = before(w).current as CustomGame;
    expect(await w.s.read(readExportedCustomGames, actor)).toContainEqual(
      expect.objectContaining({
        id: game.id,
        white: game.white,
        black: game.black,
        minutes: game.minutes,
        increment: game.increment,
        moves: game.moves.map(({ uci, san }) => ({ uci, san })),
        outcome: String(w.memo.get('custom-game-resigned')),
      })
    );
    expect(game.moves.map((move) => move.uci)).toEqual(
      recordedLine(gameOf(w), gameOf(w).fixtures.firstSideVictory.slice(0, 1))
    );
  }
);
Then(
  "{actor}'s personal-data export cannot include {actor}'s custom game",
  async (w, actor: string) => {
    expect(await w.s.read(readExportedCustomGames, actor)).toEqual([]);
  }
);
