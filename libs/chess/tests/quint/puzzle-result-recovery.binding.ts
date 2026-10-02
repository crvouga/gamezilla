import {
  finishPuzzleBy,
  openPuzzleFromSpace,
  showChessStatsScreen,
} from '@libs/chess/harness/chess-actions';
import { readActivePuzzleId } from '@libs/chess/harness/chess-puzzle-ui';
import { finishPuzzleAsAppCloses } from '@libs/chess/harness/puzzle-close-during-finish';
import {
  closePuzzleApp,
  puzzleRecoveryState,
  reopenPuzzleApp,
  retryFinishedPuzzle,
} from '@libs/chess/harness/puzzle-result-recovery';
import { signInWithGoogle, signInWithGoogleAsAccount } from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import {
  partition,
  restoreActorConnection,
} from '@libs/harness/system/actions';
import { focusActor } from '@libs/harness/system/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces/harness/space-actions';
import { readSpaceLink } from '@libs/spaces/harness/spaces-ui-reads';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';

const FINISH = {
  CleanSolve: 'clean',
  HintedSolve: 'hintThenSolve',
  WrongMove: 'wrongRetrySolve',
  ShownSolution: 'showSolution',
  Skipped: 'skip',
} as const;

function finish(picks: Picks) {
  const selected = picks['result'];
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
      await w.s.apply(openPuzzleFromSpace, 'alice');
      const puzzle = await w.s.read(readActivePuzzleId, 'alice');
      if (puzzle === null) throw new Error('No active puzzle');
      w.memo.set('result-puzzle', puzzle);
    },
    finish: (w, picks) => w.s.apply(finishPuzzleBy, 'alice', finish(picks)),
    finishAsAppCloses: (w, picks) =>
      w.s.apply(finishPuzzleAsAppCloses, 'alice', finish(picks)),
    retryAndSolve: (w) => w.s.apply(retryFinishedPuzzle, 'alice'),
    readStats: async (w) => {
      await w.s.apply(focusActor, 'alice');
      await w.s.apply(showChessStatsScreen, 'alice');
    },
    closeApp: (w, picks) => w.s.apply(closePuzzleApp, String(picks['device'])),
    reopenApp: (w, picks) =>
      w.s.apply(reopenPuzzleApp, String(picks['device'])),
    _loseConnection: (w, picks) =>
      w.s.apply(partition, String(picks['device'])),
    _connectionReturns: (w, picks) =>
      w.s.apply(restoreActorConnection, String(picks['device'])),
    _wait: (w) => w.s.advanceTime(1_000),
  },
  observe: async (w) => {
    const state = await w.quiet.read(
      puzzleRecoveryState,
      rememberedId(w, 'result-space'),
      rememberedId(w, 'result-puzzle')
    );
    return {
      ...state,
      firstResult: variant(state.firstResult),
      ratedResult: new Map<QuintValue, QuintValue>(
        [...state.ratedResult].map(([device, result]) => [
          device,
          variant(result),
        ])
      ),
    };
  },
});
