/**
 * `specs/chess/puzzle-session.qnt` against the chess composition: a guest
 * hosting a space plays puzzles through the chess sim actions while another
 * guest in the space watches, and the model's state is read back off both
 * screens. Puzzle ids are opaque, so each is numbered in the order it first
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
} from '@libs/chess/sim/chess-actions';
import { readLocalPuzzleStartLedger } from '@libs/chess/sim/chess-puzzle-ledger-data';
import {
  readActivePuzzleId,
  readPuzzleStatus,
} from '@libs/chess/sim/chess-puzzle-ui';
import { focusActor, restartApp } from '@libs/sim-harness';
import type { QuintSimWorld } from '@libs/sim-harness/quint/world';
import { bringToFront, visible } from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces/sim/space-actions';
import { readSpaceLink } from '@libs/spaces/sim/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel } from '@pkgs/quint/registry';

const HOST = 'alice';
const WATCHER = 'bob';
const PEOPLE = [HOST, WATCHER] as const;
/** Memo key: puzzle ids in the order they first reached the host's board. */
const SEEN = 'seenPuzzles';

function seen(w: QuintSimWorld): readonly string[] {
  const ids = w.memo.get(SEEN);
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/** Number the puzzle now on the host's board, if it is new. */
async function notePuzzle(w: QuintSimWorld): Promise<void> {
  const id = await w.s.read(readActivePuzzleId, HOST);
  if (id === null) throw new Error(`${HOST} has no puzzle on the board`);
  const ids = seen(w);
  if (!ids.includes(id)) w.memo.set(SEEN, [...ids, id]);
}

/** A puzzle never noted numbers as -2: the model never shows one. */
function numberOf(w: QuintSimWorld, id: string | null): number {
  if (id === null) return -1;
  const n = seen(w).indexOf(id);
  return n === -1 ? -2 : n;
}

type Screen = 'Board' | 'ChessMenu' | 'GameMenu' | 'Elsewhere';

async function screenOf(s: ProductSim, actorId: string): Promise<Screen> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.chessPuzzlePlayScreen])) {
    return 'Board';
  }
  if (await visible(s, actorId, [Handles.chessMenuPuzzle])) return 'ChessMenu';
  if (await visible(s, actorId, [Handles.gameMenuChess])) return 'GameMenu';
  return 'Elsewhere';
}

/** The host drives: bring her screen to the front, then act on it. */
function hostDoes(
  act: (w: QuintSimWorld) => Promise<void>,
  landsOnBoard = false
): (w: QuintSimWorld) => Promise<void> {
  return async (w) => {
    await w.s.apply(focusActor, HOST);
    await act(w);
    if (landsOnBoard) await notePuzzle(w);
  };
}

bindQuintModel<QuintSimWorld>({
  model: 'puzzle-session',
  traces: 6,
  maxSteps: 12,
  // Two screens read after every step: a trace runs ~10s alone, but several
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
    openBoard: hostDoes((w) => w.s.apply(openPuzzleFromSpace, HOST), true),
    reopenBoard: hostDoes(
      (w) => w.s.apply(reopenPuzzleFromChessMenu, HOST),
      true
    ),
    leaveBoard: hostDoes((w) => w.s.apply(leavePuzzleToChessMenu, HOST)),
    backToGameMenu: hostDoes((w) => w.s.apply(leaveChessMenuToGameMenu, HOST)),
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
  },
  observe: async (w) => {
    const screen = new Map<QuintValue, QuintValue>();
    const status = new Map<QuintValue, QuintValue>();
    const nextOffered = new Map<QuintValue, QuintValue>();
    const puzzle = new Map<QuintValue, QuintValue>();
    const starts = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const shown = await w.quiet.read(screenOf, actor);
      const onBoard = shown === 'Board';
      screen.set(actor, variant(shown));
      status.set(
        actor,
        onBoard
          ? ((await w.quiet.read(readPuzzleStatus, actor)) ?? 'unknown')
          : 'none'
      );
      nextOffered.set(
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
      starts.set(
        actor,
        (await w.quiet.read(readLocalPuzzleStartLedger, actor)).length
      );
    }
    return { screen, status, nextOffered, puzzle, starts };
  },
});
