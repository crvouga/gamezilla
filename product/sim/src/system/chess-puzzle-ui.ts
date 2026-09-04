import { Handles } from '@libs/test-ids';
import { ChessBoardFlows } from '@pkgs/chess-board/chess-board-flows';
import type { Square } from '@pkgs/chess-board/chess-board-types';
import type { DriverNode } from '@pkgs/ui-testing';

import { actorUi, pollUntil } from './actor-ui';
import type { ProductSim } from './sim';
import { waitActiveSpace } from './space-ui';

const WAIT_MS = 15_000;
const INTERACTIVE_MS = 2_500;
const POLL_MS = 250;

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/\u200b/g, '').trim();
}

function puzzleBoard(s: ProductSim, actorId: string): Promise<ChessBoardFlows> {
  return actorUi(s, actorId).then(
    (ui) => new ChessBoardFlows(ui, Handles.chessPuzzleBoard)
  );
}

function parseUciSquares(uci: string): { from: Square; to: Square } {
  const t = uci.trim().toLowerCase();
  if (t.length < 4) {
    throw new Error(`invalid uci: ${uci}`);
  }
  return { from: t.slice(0, 2) as Square, to: t.slice(2, 4) as Square };
}

export async function isPuzzleSolved(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.chessPuzzleSummary).isVisible()) return true;
  try {
    const debug = stripProbe(await ui.get(Handles.chessPuzzleE2eDebug).text());
    return debug.startsWith('solved|');
  } catch {
    return false;
  }
}

async function readE2eField(
  s: ProductSim,
  actorId: string,
  index: number
): Promise<string | undefined> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleE2eDebug).text());
    return raw.split('|')[index];
  } catch {
    return undefined;
  }
}

async function waitUntilInteractiveOrSolved(
  s: ProductSim,
  actorId: string
): Promise<void> {
  try {
    await pollUntil(
      s,
      async () => {
        if (await isPuzzleSolved(s, actorId)) return true;
        return (await readE2eField(s, actorId, 1)) === '1' ? true : null;
      },
      {
        maxMs: INTERACTIVE_MS,
        stepMs: POLL_MS,
        description: 'puzzle interactive or solved',
      }
    );
  } catch {
    // Spectators never become interactive — proceed either way.
  }
}

export async function expectPlayReady(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzlePlayScreen).expect.visible({
    timeoutMs: WAIT_MS,
  });
  const frame = ui.get(Handles.chessPuzzleBoardFrame);
  await waitBoardReady(s, actorId, frame);
  await waitBoardReady(s, actorId, frame);
  await waitUntilInteractiveOrSolved(s, actorId);
}

async function waitBoardReady(
  s: ProductSim,
  actorId: string,
  frame: DriverNode
): Promise<void> {
  const ui = await actorUi(s, actorId);
  const boardNode = ui.get(Handles.chessPuzzleBoard);
  const board = await puzzleBoard(s, actorId);
  await pollUntil(
    s,
    async () => {
      await frame.layout();
      if (!(await boardNode.isVisible())) return null;
      try {
        const probe = await board.readProbe();
        return probe.size > 0 ? true : null;
      } catch {
        return null;
      }
    },
    { maxMs: WAIT_MS, description: 'chess-puzzle-board ready' }
  );
}

export async function openPuzzlePlay(
  s: ProductSim,
  actorId: string
): Promise<void> {
  await waitActiveSpace(s, actorId);
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.gameMenuChess).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.gameMenuChess).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(Handles.chessMenuPuzzle).tap({ timeoutMs: WAIT_MS });
  await expectPlayReady(s, actorId);
}

async function waitExpectedUci(
  s: ProductSim,
  actorId: string
): Promise<string> {
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleExpectedUci);
  await node.wait('visible', { timeoutMs: WAIT_MS });
  return pollUntil(
    s,
    async () => {
      if (await isPuzzleSolved(s, actorId)) {
        throw new Error('expected UCI but puzzle already solved');
      }
      const uci = stripProbe(await node.text()).toLowerCase();
      return uci.length >= 4 ? uci : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'expected uci' }
  );
}

async function waitAfterHumanMove(
  s: ProductSim,
  actorId: string,
  playedUci: string
): Promise<void> {
  const played = playedUci.trim().toLowerCase();
  const ui = await actorUi(s, actorId);
  const node = ui.get(Handles.chessPuzzleExpectedUci);
  try {
    await pollUntil(
      s,
      async () => {
        if (await isPuzzleSolved(s, actorId)) return true;
        const uci = stripProbe(await node.text()).toLowerCase();
        return uci.length >= 4 && uci !== played ? true : null;
      },
      { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'next expected uci' }
    );
  } catch {
    // Best effort — the caller's next assertion reports the truth.
  }
}

async function playExpectedMove(s: ProductSim, actorId: string): Promise<void> {
  const uci = await waitExpectedUci(s, actorId);
  const squares = parseUciSquares(uci);
  const board = await puzzleBoard(s, actorId);
  await board.drag(squares.from, squares.to);
  await waitAfterHumanMove(s, actorId, uci);
}

export async function solvePuzzle(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const maxMoves = 16;
  for (let i = 0; i < maxMoves; i += 1) {
    if (await isPuzzleSolved(s, actorId)) {
      await waitPuzzleSolved(s, actorId);
      return;
    }
    await playExpectedMove(s, actorId);
  }
  await waitPuzzleSolved(s, actorId);
}

export async function waitPuzzleSolved(
  s: ProductSim,
  actorId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleSummary).expect.visible({
    timeoutMs: WAIT_MS,
  });
}
