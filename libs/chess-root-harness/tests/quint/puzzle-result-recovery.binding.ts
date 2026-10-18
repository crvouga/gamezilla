import { finishPuzzleBy } from '@libs/chess-puzzle-harness/chess-actions';
import { finishPuzzleAsAppCloses } from '@libs/chess-puzzle-harness/puzzle-close-during-finish';
import { finishCompetingPuzzleResults } from '@libs/chess-puzzle-harness/puzzle-competing-mates';
import {
  closePuzzleApp,
  puzzleRecoveryState,
  reopenPuzzleApp,
  retryFinishedPuzzle,
  viewRecoveryStats,
} from '@libs/chess-puzzle-harness/puzzle-result-recovery';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  openGamePuzzles,
  readPuzzleOnBoard,
} from '@libs/game-session-harness/puzzle-screen';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
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
      await w.s.apply(openGamePuzzles, 'alice', CHESS_GAME_ID);
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
    finish: (w, picks) => w.s.apply(finishPuzzleBy, 'alice', finish(picks)),
    finishAsAppCloses: (w, picks) =>
      w.s.apply(finishPuzzleAsAppCloses, 'alice', finish(picks)),
    finishAlongsideOtherDevice: async (w, picks) => {
      await w.s.apply(finishCompetingPuzzleResults, {
        actor: 'alice',
        other: 'charlie',
        first: finish(picks),
        second: finish(picks, 'otherResult'),
        reconnectOther: true,
      });
      w.memo.set('recovery-other-joined', true);
    },
    retryAndSolve: (w) => w.s.apply(retryFinishedPuzzle, 'alice'),
    readStats: async (w) => {
      await w.s.apply(
        viewRecoveryStats,
        w.memo.get('recovery-other-joined') === true
      );
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
      await w.s.apply(viewRecoveryStats, true);
      w.memo.set('recovery-reading-stats', true);
    },
    closeApp: (w, picks) => w.s.apply(closePuzzleApp, String(picks['device'])),
    reopenApp: async (w, picks) => {
      await w.s.apply(reopenPuzzleApp, String(picks['device']));
      if (w.memo.get('recovery-reading-stats') === true)
        await w.s.apply(
          viewRecoveryStats,
          w.memo.get('recovery-other-joined') === true
        );
    },
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['device'])),
    connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['device'])),
    _wait: (w) => w.s.advanceTime(1_000),
  },
  observe: async (w) => {
    const state = await w.quiet.read(
      puzzleRecoveryState,
      rememberedId(w, 'result-puzzle'),
      w.memo.get('recovery-reading-stats') === true,
      w.memo.get('recovery-other-joined') === true
    );
    return {
      ...state,
      ratedResult: new Map<QuintValue, QuintValue>(
        [...state.ratedResult].map(([device, result]) => [
          device,
          variant(result),
        ])
      ),
    };
  },
});
