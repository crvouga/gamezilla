import { attemptOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  decodeSokobanAction,
  decodeSokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-position';
import { solveSokoban } from '@libs/sokoban-shared-ts/sokoban-solver';
import type {
  SokobanDirection,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import {
  arrangePublishedPack,
  createSokobanDraft,
  PLAIN_BOARD,
  playtestByMutation,
  startAttemptByMutation,
} from './sokoban-fixtures';
import { type LayoutTable, layoutDefinition } from './sokoban-layout';
import {
  clickWhenReady,
  deviceLibrary,
  devicePlay,
  openAttemptOnScreen,
  playView,
  screensOf,
  settlePlay,
  waitFor,
} from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

const KEYS: Readonly<Record<SokobanDirection, string>> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

function playing(s: SokobanHarness, clientId: string): string {
  const play = screensOf(s, clientId).play;
  if (play === null) throw new Error(`${clientId} is not playing`);
  return play.attemptId;
}

/** The open attempt's definition and saved position, read from the device. */
export async function playedPosition(
  s: SokobanHarness,
  clientId: string
): Promise<{
  readonly definition: string;
  readonly positionId: string;
  readonly position: SokobanPosition;
} | null> {
  const saved = await attemptOnDevice(s, clientId, playing(s, clientId));
  const board = decodeSokobanBoard(saved?.definition ?? '');
  if (saved === null || !board.valid) return null;
  const position = decodeSokobanPosition(board.value, saved.state);
  return position.valid
    ? {
        definition: saved.definition,
        positionId: saved.positionId,
        position: position.value,
      }
    : null;
}

async function afterChange(
  s: SokobanHarness,
  clientId: string,
  before: string | undefined
): Promise<void> {
  await waitFor(
    s,
    async () => (await playedPosition(s, clientId))?.positionId !== before
  );
  await settlePlay(s, clientId);
}

export async function moveOnScreen(
  s: SokobanHarness,
  clientId: string,
  direction: SokobanDirection
): Promise<void> {
  const view = playView(s, clientId);
  const before = (await playedPosition(s, clientId))?.positionId;
  fireEvent.keyDown(view.getByTestId('sokoban-board'), {
    key: KEYS[direction],
  });
  const refusal = view.queryByTestId('sokoban-refusal');
  screensOf(s, clientId).told = refusal?.getAttribute('data-code') ?? null;
  if (refusal === null) await afterChange(s, clientId, before);
}

/** Undo and redo are offered only when there is a position to go to. */
async function travelOnScreen(
  s: SokobanHarness,
  clientId: string,
  kind: 'undo' | 'redo'
): Promise<void> {
  const view = playView(s, clientId);
  const button = view.getByTestId(`content-${kind}`);
  if (button.hasAttribute('disabled')) {
    screensOf(s, clientId).told =
      kind === 'undo' ? 'PUZZLE_NO_EARLIER_POSITION' : 'PUZZLE_NO_REDO';
    return;
  }
  screensOf(s, clientId).told = null;
  const before = (await playedPosition(s, clientId))?.positionId;
  fireEvent.click(button);
  await afterChange(s, clientId, before);
}

export async function restartOnScreen(
  s: SokobanHarness,
  clientId: string
): Promise<void> {
  const view = playView(s, clientId);
  const earlier = playing(s, clientId);
  await clickWhenReady(s, view, 'content-restart');
  await clickWhenReady(s, view, 'content-restart-confirm');
  await clickWhenReady(s, view, 'content-open-restart');
  const play = await devicePlay(s, clientId);
  const source = play.attempts.find((entry) => entry.id === earlier)?.source_id;
  const restarted = play.attempts
    .filter((entry) => entry.source_id === source && entry.id !== earlier)
    .toSorted((a, b) => b.activity_order - a.activity_order)[0];
  if (restarted === undefined) throw new Error('No restarted attempt');
  const screens = screensOf(s, clientId);
  if (screens.play !== null) screens.play.attemptId = restarted.id;
  await waitFor(s, async () => (await playedPosition(s, clientId)) !== null);
  await settlePlay(s, clientId);
}

/** Plays a shortest completion from the saved position, move by move on screen. */
export async function completeOnScreen(
  s: SokobanHarness,
  clientId: string
): Promise<void> {
  const played = await playedPosition(s, clientId);
  const board = decodeSokobanBoard(played?.definition ?? '');
  if (played === null || !board.valid) throw new Error('Nothing to complete');
  const solution = solveSokoban(
    {
      ...board.value,
      worker: played.position.worker,
      crates: played.position.crates,
    },
    { maxStates: 200_000 }
  );
  if (solution.status !== 'solved') throw new Error('No completion is left');
  for (const action of solution.actions) {
    const direction = decodeSokobanAction(action);
    if (!direction.valid) throw new Error(`Unreadable action ${action}`);
    await moveOnScreen(s, clientId, direction.value);
  }
}

export const playOwnSokobanBoard = defineAction({
  name: 'playOwnSokobanBoard',
  act: async (s: SokobanHarness, clientId: string, table: LayoutTable) => {
    const draft = await createSokobanDraft(s, clientId, {
      title: 'Practice',
      definition: layoutDefinition(table),
    });
    const attemptId = await playtestByMutation(s, clientId, draft, []);
    await openAttemptOnScreen(s, clientId, attemptId);
  },
});

export const playSokobanPackPuzzle = defineAction({
  name: 'playSokobanPackPuzzle',
  act: async (
    s: SokobanHarness,
    args: {
      readonly title: string;
      readonly pack: string;
      readonly titles: string;
      readonly table: LayoutTable;
    }
  ) => {
    const puzzles = args.titles.split(', ').map((title) => ({
      title,
      definition:
        title === args.title ? layoutDefinition(args.table) : PLAIN_BOARD,
    }));
    const packRevisionId = await arrangePublishedPack(s, {
      title: args.pack,
      puzzles,
    });
    const library = await deviceLibrary(s, 'alice:phone');
    const revisionId = library.revisions.find(
      (edition) => edition.kind === 'puzzle' && edition.title === args.title
    )?.id;
    if (revisionId === undefined) throw new Error(`No edition ${args.title}`);
    const attemptId = await startAttemptByMutation(s, 'bob:phone', {
      revisionId,
      packRevisionId,
    });
    await openAttemptOnScreen(s, 'bob:phone', attemptId);
  },
});

export const moveSokobanWorker = defineAction({
  name: 'moveSokobanWorker',
  act: (s: SokobanHarness, clientId: string, direction: SokobanDirection) =>
    moveOnScreen(s, clientId, direction),
});
export const undoSokobanMove = defineAction({
  name: 'undoSokobanMove',
  act: (s: SokobanHarness, clientId: string) =>
    travelOnScreen(s, clientId, 'undo'),
});
export const redoSokobanMove = defineAction({
  name: 'redoSokobanMove',
  act: (s: SokobanHarness, clientId: string) =>
    travelOnScreen(s, clientId, 'redo'),
});
export const restartSokobanPuzzle = defineAction({
  name: 'restartSokobanPuzzle',
  act: restartOnScreen,
});
export const completeSokobanPuzzle = defineAction({
  name: 'completeSokobanPuzzle',
  act: completeOnScreen,
});

/** What the open attempt shows: its counts and whether it says it is complete. */
export function shownPlay(s: SokobanHarness, clientId: string) {
  const view = playView(s, clientId);
  const counts = view.getByTestId('sokoban-counts');
  return {
    moves: Number(counts.getAttribute('data-moves')),
    pushes: Number(counts.getAttribute('data-pushes')),
    complete: view.queryByTestId('content-attempt-complete') !== null,
  };
}

export function toldOnScreen(
  s: SokobanHarness,
  clientId: string
): string | null {
  return screensOf(s, clientId).told;
}

export const SOKOBAN_PLAY_ACTIONS = [
  playOwnSokobanBoard,
  playSokobanPackPuzzle,
  moveSokobanWorker,
  undoSokobanMove,
  redoSokobanMove,
  restartSokobanPuzzle,
  completeSokobanPuzzle,
] as const;
