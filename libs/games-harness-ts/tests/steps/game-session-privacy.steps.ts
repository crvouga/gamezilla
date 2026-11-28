/**
 * Account deletion and personal-data exports for game sessions. The world's
 * `beforeAccountDeletion` (in `index.ts`) gives a deleted account a custom
 * game of the run's game before the deletion completes.
 */

import { expect } from 'bun:test';
import { readExportedGameSessions } from '@libs/game-session-harness-ts/game-session-export';
import { recordedLine } from '@libs/game-session-harness-ts/played-rules';
import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { Given, Then } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { recall, remember } from '@libs/harness-ts/spec-world';
import { openSpaceLink } from '@libs/spaces-harness-ts/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { seesNoGameSession, tryToWatch } from './game-session-access.steps';
import { current } from './game-session-set-up-world';
import {
  before,
  rememberGameSession,
  setupGameSession,
  spaceLinkOf,
  turnGameOf,
} from './game-world';

const DELETED_GAME = 'deleted-game-session-id';
const DELETED_LINK = 'deleted-game-session-link';

/** `actor`, whose account is about to be deleted, has a game session set up. */
export async function gameSessionBeforeDeletion(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await setupGameSession(w, {
    host: actor,
    first: actor,
    second: 'open',
    ready: false,
    active: false,
  });
  await rememberGameSession(w);
  remember(w, DELETED_GAME, (await current(w)).id);
  remember(w, DELETED_LINK, await spaceLinkOf(w));
}

Given("{actor}'s deleted account had a game session", async (w) => {
  expect(recall(w, DELETED_GAME)).toBeString();
  expect(recall(w, DELETED_LINK)).toBeString();
});

Then("{actor}'s space has not ended", async (w, actor: string) => {
  await w.s.apply(openSpaceLink, actor, await spaceLinkOf(w));
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
});
Then(
  "{actor} cannot see the deleted account's game session",
  async (w, actor: string) => {
    await tryToWatch(w, actor, String(recall(w, DELETED_LINK)));
    await seesNoGameSession(w, actor);
  }
);
// regression: game-session-personal-export-omits-games
Then(
  "{actor}'s personal-data export includes the game session's choices, moves and result",
  async (w, actor: string) => {
    const game = before(w).current as GameSession;
    expect(await w.s.read(readExportedGameSessions, actor)).toContainEqual(
      expect.objectContaining({
        id: game.id,
        white: game.white,
        black: game.black,
        minutes: game.minutes,
        increment: game.increment,
        moves: game.moves.map(({ uci, san }) => ({ uci, san })),
        outcome: String(w.memo.get('game-session-resigned')),
      })
    );
    expect(game.moves.map((move) => move.uci)).toEqual(
      recordedLine(
        turnGameOf(w),
        turnGameOf(w).fixtures.firstSideVictory.slice(0, 1)
      )
    );
  }
);
Then(
  "{actor}'s personal-data export cannot include {actor}'s game session",
  async (w, actor: string) => {
    expect(await w.s.read(readExportedGameSessions, actor)).toEqual([]);
  }
);
