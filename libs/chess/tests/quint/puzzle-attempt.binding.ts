/**
 * `specs/chess/puzzle-attempt.qnt` against the chess composition: a guest
 * hosting a space plays puzzles through the chess harness actions while another
 * guest in the space watches, and the model's state is read back off both
 * views. Puzzle ids are opaque, so each is numbered in the order it first
 * reached the host's board.
 */

import {
  leaveChessMenuToGameMenu,
  leavePuzzleToChessMenu,
  openPuzzleFromSpace,
  playUntilSolved,
  playWrongPuzzleMove,
  pressPuzzleNext,
  pressPuzzleNextTwice,
  reopenPuzzleFromChessMenu,
  retryPuzzle,
  returnToOwnSpace,
  showPuzzleSolutionLine,
  skipPuzzle,
} from '@libs/chess/harness/chess-actions';
import { readLocalPuzzleStartLedger } from '@libs/chess/harness/chess-puzzle-ledger-data';
import {
  readActivePuzzleId,
  readPuzzleStatus,
} from '@libs/chess/harness/chess-puzzle-ui';
import {
  focusActor,
  partition,
  restartApp,
  restoreNetwork,
} from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import type { ProductHarness } from '@libs/harness/system/harness';
import { bringToFront, visible } from '@libs/harness/system/observations';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces/harness/space-actions';
import { readSpaceLink } from '@libs/spaces/harness/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel } from '@pkgs/quint/registry';

const HOST = 'alice';
const WATCHER = 'bob';
const PEOPLE = [HOST, WATCHER] as const;
/** Memo key: puzzle ids in the order they first reached the host's board. */
const SEEN = 'seenPuzzles';

function seen(w: QuintHarnessWorld): readonly string[] {
  const ids = w.memo.get(SEEN);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/** Number the puzzle now on the host's board, if it is new. */
async function notePuzzle(w: QuintHarnessWorld): Promise<void> {
  const id = await w.s.read(readActivePuzzleId, HOST);
  if (id === null) throw new Error(`${HOST} has no puzzle on the board`);
  const ids = seen(w);
  if (!ids.includes(id)) w.memo.set(SEEN, [...ids, id]);
}

/** A puzzle never noted numbers as -2: the model never shows one. */
function numberOf(w: QuintHarnessWorld, id: string | null): number {
  if (id === null) return -1;
  const n = seen(w).indexOf(id);
  return n === -1 ? -2 : n;
}

type View = 'Board' | 'ChessChoices' | 'GameChoice' | 'Elsewhere';

async function viewOf(s: ProductHarness, actorId: string): Promise<View> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.chessPuzzlePlayScreen])) {
    return 'Board';
  }
  if (await visible(s, actorId, [Handles.chessMenuPuzzle]))
    return 'ChessChoices';
  if (await visible(s, actorId, [Handles.gameMenuChess])) return 'GameChoice';
  return 'Elsewhere';
}

/** The host drives: bring her view to the front, then act on it. */
function hostDoes(
  act: (w: QuintHarnessWorld) => Promise<void>,
  landsOnBoard = false
): (w: QuintHarnessWorld) => Promise<void> {
  return async (w) => {
    await w.s.apply(focusActor, HOST);
    await act(w);
    if (landsOnBoard) await notePuzzle(w);
  };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'puzzle-attempt',
  traces: 12,
  maxSteps: 16,
  // Two views read after every step: a trace runs ~10s alone, but several
  // times that beside the rest of the package's suite.
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(focusActor, HOST);
      await w.s.apply(createSpace, HOST);
      const link = await w.s.read(readSpaceLink, HOST);
      if (link === null) throw new Error(`${HOST} opened no space`);
      await w.s.apply(openSpaceLink, WATCHER, link);
      await w.s.apply(joinFromPrompt, WATCHER);
    },
    openPuzzles: hostDoes((w) => w.s.apply(openPuzzleFromSpace, HOST), true),
    goBackToPuzzles: hostDoes(
      (w) => w.s.apply(reopenPuzzleFromChessMenu, HOST),
      true
    ),
    leavePuzzle: hostDoes((w) => w.s.apply(leavePuzzleToChessMenu, HOST)),
    backToGameChoice: hostDoes((w) =>
      w.s.apply(leaveChessMenuToGameMenu, HOST)
    ),
    solve: hostDoes((w) => w.s.apply(playUntilSolved, HOST)),
    playWrongMove: hostDoes((w) => w.s.apply(playWrongPuzzleMove, HOST)),
    showSolution: hostDoes((w) => w.s.apply(showPuzzleSolutionLine, HOST)),
    skip: hostDoes((w) => w.s.apply(skipPuzzle, HOST)),
    retry: hostDoes((w) => w.s.apply(retryPuzzle, HOST)),
    moveOn: hostDoes((w) => w.s.apply(pressPuzzleNext, HOST), true),
    moveOnTwiceAtOnce: hostDoes(
      (w) => w.s.apply(pressPuzzleNextTwice, HOST),
      true
    ),
    reopenApp: hostDoes(async (w) => {
      await w.s.apply(restartApp, HOST);
      await w.s.apply(returnToOwnSpace, HOST);
    }),
    _loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
    },
    _connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
    },
  },
  observe: async (w) => {
    const view = new Map<QuintValue, QuintValue>();
    const puzzleState = new Map<QuintValue, QuintValue>();
    const moveOnOffered = new Map<QuintValue, QuintValue>();
    const puzzle = new Map<QuintValue, QuintValue>();
    const puzzleStarts = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const shown = await w.quiet.read(viewOf, actor);
      const onBoard = shown === 'Board';
      view.set(actor, variant(shown));
      puzzleState.set(
        actor,
        onBoard
          ? ((await w.quiet.read(readPuzzleStatus, actor)) ?? 'unknown')
          : 'none'
      );
      moveOnOffered.set(
        actor,
        await w.quiet.read(visible, actor, [Handles.chessPuzzleActionNext])
      );
      puzzle.set(
        actor,
        numberOf(
          w,
          onBoard ? await w.quiet.read(readActivePuzzleId, actor) : null
        )
      );
      puzzleStarts.set(
        actor,
        (await w.quiet.read(readLocalPuzzleStartLedger, actor)).length
      );
    }
    return { view, puzzleState, moveOnOffered, puzzle, puzzleStarts };
  },
});
