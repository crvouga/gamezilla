/**
 * `specs/games/puzzle-feed.qnt` against one account signed in on two
 * devices (alice and charlie), both on the trace's game's puzzles in the
 * account's space. Each feed choice is set through the feed settings
 * themselves ("chosen theme" is a theme of the game's known puzzle), and
 * the saved choice is read back off each device's feed bar.
 */

import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  closePuzzleFeedSettings,
  discardFeedSettings,
  openPuzzleFeedSettings,
} from '@libs/game-session-harness-ts/puzzle-feed';
import {
  previewPuzzleFeedChoice,
  readSavedFeedChoice,
} from '@libs/game-session-harness-ts/puzzle-feed-choices';
import {
  openGamePuzzles,
  readPuzzleControls,
} from '@libs/game-session-harness-ts/puzzle-screen';
import {
  partition,
  restartApp,
  restoreActorConnection,
} from '@libs/harness-ts/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import { bringToFront } from '@libs/harness-ts/observations';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  returnToOwnSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { conformanceGameOf } from '../conformance-world';
import autoAdvanceTrace from './fixtures/puzzle-feed-auto-advance-save.itf.json';

const SOLVER = 'alice';
const SECOND_DEVICE = 'charlie';

/** The game this trace is replayed for: one offering puzzles. */
function gameOfTrace(w: QuintHarnessWorld): HarnessGame {
  return conformanceGameOf(w.ctx.variant, w.ctx.title);
}

function gameId(w: QuintHarnessWorld): string {
  return gameOfTrace(w).shared.id;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-feed',
  traces: 24,
  maxSteps: 32,
  timeoutMs: 180_000,
  regressions: [
    // regression: puzzle-feed-draft-auto-advance
    {
      id: 'puzzle-feed-auto-advance-save',
      title: 'A saved auto-advance preference survives reopening',
      seed: '0x67932',
      itf: autoAdvanceTrace,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, SOLVER);
      await w.s.apply(signInWithGoogleAsAccount, SECOND_DEVICE, SOLVER);
      await w.s.apply(createSpace, SOLVER);
      await w.s.apply(openGamePuzzles, SOLVER, gameId(w));
      await w.s.apply(returnToOwnSpace, SECOND_DEVICE);
      await w.s.apply(openGamePuzzles, SECOND_DEVICE, gameId(w));
    },
    startEditingFeed: async (w) => {
      await w.s.apply(focusActor, SOLVER);
      await w.s.apply(openPuzzleFeedSettings, SOLVER);
    },
    previewFeedChoice: (w, picks) =>
      w.s.apply(
        previewPuzzleFeedChoice,
        SOLVER,
        gameId(w),
        String(picks['choice'])
      ),
    saveFeedChoices: (w) => w.s.apply(closePuzzleFeedSettings, SOLVER),
    discardFeedChoices: (w) => w.s.apply(discardFeedSettings, SOLVER),
    reopenApp: async (w) => {
      await w.s.apply(restartApp, SOLVER);
      await w.s.apply(returnToOwnSpace, SOLVER);
      await w.s.apply(openGamePuzzles, SOLVER, gameId(w));
    },
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['device'])),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['device'])),
    _wait: (w) => w.s.advanceTime(1_000),
  },
  observe: async (w) => {
    const feedChoice = new Map<string, string>();
    for (const device of [SOLVER, SECOND_DEVICE])
      feedChoice.set(
        device,
        await w.quiet.read(readSavedFeedChoice, device, gameId(w))
      );
    await w.quiet.read(bringToFront, SOLVER);
    return {
      feedChoice,
      editing: (await w.quiet.read(readPuzzleControls, SOLVER))
        .feedSettingsOpen,
    };
  },
});
