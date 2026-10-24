/**
 * `specs/games/puzzle-result-recovery.qnt` on the product, for each
 * conformance game offering puzzles: Alice plays one rated puzzle of the
 * game in her space, Bob watches it, and Charlie is another device of
 * Alice's account. Every finish is made as a person makes it (or, as the
 * app closes, already sent); every result is read back off the stats each
 * open device shows.
 */

import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  finishGamePuzzleAsAppCloses,
  finishGamePuzzleBy,
  finishGamePuzzleOnTwoDevices,
} from '@libs/game-session-harness-ts/puzzle-finishes';
import {
  closePuzzleApp,
  readPuzzleResultsShown,
  reopenPuzzleApp,
  retryFinishedGamePuzzle,
  viewEachDevicePuzzleStats,
} from '@libs/game-session-harness-ts/puzzle-result-recovery';
import {
  openGamePuzzles,
  readPuzzleOnBoard,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { variant } from '@pkgs/quint-shared-ts/itf';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { turnConformanceGameOf } from '../conformance-world';
import competingRatingTrace from './fixtures/puzzle-competing-equal-rating.itf.json';
import unrecordedResultTrace from './fixtures/puzzle-recovery-before-next.itf.json';
import watcherReadyTrace from './fixtures/puzzle-recovery-watcher-not-ready.itf.json';
import personalStatsTrace from './fixtures/puzzle-result-after-close-personal-stats.itf.json';

const FINISH = {
  CleanSolve: 'clean',
  HintedSolve: 'hintThenSolve',
  WrongMove: 'wrongRetrySolve',
  ShownSolution: 'showSolution',
  Skipped: 'skip',
} as const;

function finish(picks: Picks, key = 'result') {
  const selected = picks[key];
  if (typeof selected !== 'object' || selected === null || !('tag' in selected))
    throw new Error('Missing finish');
  const tag = selected['tag'];
  if (typeof tag !== 'string' || !(tag in FINISH))
    throw new Error('Unknown finish');
  return FINISH[tag as keyof typeof FINISH];
}

const DEVICES = ['alice', 'bob', 'charlie'] as const;

function gameId(w: QuintHarnessWorld): string {
  const game: TurnHarnessGame = turnConformanceGameOf(
    w.ctx.variant,
    w.ctx.title
  );
  return game.shared.id;
}

/** The open devices that read their stats: Charlie once it has joined. */
function readers(w: QuintHarnessWorld): readonly string[] {
  return w.memo.get('recovery-other-joined') === true
    ? DEVICES
    : ['alice', 'bob'];
}

function rememberedId(w: QuintHarnessWorld, key: string): string {
  const id = w.memo.get(key);
  if (typeof id !== 'string') throw new Error(`Missing ${key}`);
  return id;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-result-recovery',
  traces: 64,
  maxSteps: 32,
  timeoutMs: 180_000,
  regressions: [
    // regression: puzzle-result-after-close-personal-stats
    {
      id: 'puzzle-result-after-close-personal-stats',
      title:
        'A closed solver records its result while personal stats are shown',
      seed: '0x67932',
      itf: personalStatsTrace,
    },
    // regression: puzzle-recovery-before-next
    {
      id: 'puzzle-recovery-before-next',
      title: 'A returning device records the first result before moving on',
      seed: '0x67932',
      itf: unrecordedResultTrace,
    },
    // regression: puzzle-recovery-watcher-not-ready
    {
      id: 'puzzle-recovery-watcher-not-ready',
      title: 'A watcher can read cached stats after losing connection',
      seed: '0x67932',
      itf: watcherReadyTrace,
    },
    // regression: puzzle-competing-equal-rating
    {
      id: 'puzzle-competing-equal-rating',
      title: 'Equal ratings still converge to the first result',
      seed: '0x67932',
      itf: competingRatingTrace,
    },
  ],
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(signInWithGoogle, 'bob');
      await w.s.apply(signInWithGoogleAsAccount, 'charlie', 'alice');
      await w.s.apply(createSpace, 'alice');
      const link = await w.s.read(readSpaceLink, 'alice');
      if (link === null) throw new Error('No hosted space');
      w.memo.set('result-space', link.slice('/space/'.length));
      await w.s.apply(openSpaceLink, 'bob', link);
      await w.s.apply(joinFromPrompt, 'bob');
      await w.s.apply(openGamePuzzles, 'alice', gameId(w));
      const puzzle = await w.s.read(readPuzzleOnBoard, 'alice');
      if (puzzle === null) throw new Error('No active puzzle');
      w.memo.set('result-puzzle', puzzle);
      // Initialization includes the watcher's cached copy before it can go offline.
      await w.s.apply(focusActor, 'bob');
      await w.s.until((s) => readPuzzleOnBoard(s, 'bob'), {
        pred: (id) => id === puzzle,
        maxMs: 15_000,
      });
      await w.s.apply(focusActor, 'alice');
    },
    finish: (w, picks) =>
      w.s.apply(finishGamePuzzleBy, 'alice', gameId(w), finish(picks)),
    finishAsAppCloses: (w, picks) =>
      w.s.apply(finishGamePuzzleAsAppCloses, 'alice', gameId(w), finish(picks)),
    finishAlongsideOtherDevice: async (w, picks) => {
      await w.s.apply(finishGamePuzzleOnTwoDevices, {
        actor: 'alice',
        other: 'charlie',
        gameId: gameId(w),
        first: finish(picks),
        second: finish(picks, 'otherResult'),
        reconnectOther: true,
      });
      w.memo.set('recovery-other-joined', true);
    },
    retryAndSolve: (w) =>
      w.s.apply(retryFinishedGamePuzzle, 'alice', gameId(w)),
    readStats: async (w) => {
      await w.s.apply(viewEachDevicePuzzleStats, readers(w), gameId(w));
      w.memo.set('recovery-reading-stats', true);
    },
    readStatsOnOtherDevice: async (w) => {
      await w.s.apply(
        openSpaceLink,
        'charlie',
        `/space/${rememberedId(w, 'result-space')}`
      );
      await w.s.apply(joinFromPrompt, 'charlie');
      w.memo.set('recovery-other-joined', true);
      await w.s.apply(viewEachDevicePuzzleStats, readers(w), gameId(w));
      w.memo.set('recovery-reading-stats', true);
    },
    closeApp: (w, picks) => w.s.apply(closePuzzleApp, String(picks['device'])),
    reopenApp: async (w, picks) => {
      const device = String(picks['device']);
      // Alice and Bob come back to their own space; Charlie to the app.
      await w.s.apply(reopenPuzzleApp, device, device !== 'charlie');
      if (w.memo.get('recovery-reading-stats') === true)
        await w.s.apply(viewEachDevicePuzzleStats, readers(w), gameId(w));
    },
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['device'])),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['device'])),
    _wait: (w) => w.s.advanceTime(1_000),
  },
  observe: async (w) => {
    const state = await w.quiet.read(readPuzzleResultsShown, {
      gameId: gameId(w),
      puzzle: rememberedId(w, 'result-puzzle'),
      devices: DEVICES,
      reading: w.memo.get('recovery-reading-stats') === true ? readers(w) : [],
    });
    return {
      gameLog: state.gameLog,
      _open: state.open,
      _online: state.online,
      ratedResult: new Map<QuintValue, QuintValue>(
        [...state.ratedResult].map(([device, result]) => [
          device,
          variant(result),
        ])
      ),
    };
  },
});
