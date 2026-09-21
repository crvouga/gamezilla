/**
 * §7 post-solve review reads and stimuli: the scrub probe, the move list, the
 * jump / step controls, arrow-key and Home / End navigation, and a horizontal
 * swipe across the board.
 */

import { actorUi, pollUntil } from '@libs/sim-harness/system/actor-ui';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import { Handles } from '@libs/test-ids';
import type { DriverKey } from '@pkgs/ui-testing';

const WAIT_MS = 15_000;
const POLL_MS = 100;

export type PuzzleNavControl = 'start' | 'back' | 'forward' | 'end';

function stripProbe(text: string | null | undefined): string {
  return (text ?? '').replace(/​/g, '').trim();
}

export type PuzzleReviewProbe = {
  readonly solveIdx: number;
  readonly lastSolveIdx: number;
  /** §7: the last seek animated (one ply) rather than snapping (a jump). */
  readonly animated: boolean;
  readonly notation: string;
};

export async function readPuzzleReviewProbe(
  s: ProductSim,
  actorId: string
): Promise<PuzzleReviewProbe | null> {
  try {
    const ui = await actorUi(s, actorId);
    const raw = stripProbe(await ui.get(Handles.chessPuzzleReviewE2e).text());
    const parts = raw.split('|');
    if (parts.length < 4) return null;
    const solveIdx = Number.parseInt(parts[0] ?? '', 10);
    const lastSolveIdx = Number.parseInt(parts[1] ?? '', 10);
    if (!Number.isFinite(solveIdx) || !Number.isFinite(lastSolveIdx)) {
      return null;
    }
    return {
      solveIdx,
      lastSolveIdx,
      animated: parts[2] === '1',
      notation: parts[3] ?? '',
    };
  } catch {
    return null;
  }
}

/** The position the review board is showing, as a FEN. */
export async function readPuzzleReviewFen(
  s: ProductSim,
  actorId: string
): Promise<string> {
  const ui = await actorUi(s, actorId);
  return stripProbe(await ui.get(Handles.chessPuzzleReviewE2eFen).text());
}

/** The SAN (or figurine) labels the move list is rendering, in order. */
export async function readPuzzleReviewMoveLabels(
  s: ProductSim,
  actorId: string
): Promise<readonly string[]> {
  const probe = await waitPuzzleReviewReady(s, actorId);
  const ui = await actorUi(s, actorId);
  const labels: string[] = [];
  for (let plyIndex = 0; plyIndex < probe.lastSolveIdx; plyIndex += 1) {
    const node = ui.get(Handles.chessPuzzleMovePly(plyIndex));
    if (!(await node.isVisible())) break;
    labels.push(stripProbe(await node.text()));
  }
  return labels;
}

/** The ply the move list is highlighting, as `<plyIndex>|<san>`. */
export async function readSelectedMoveLabel(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  try {
    const ui = await actorUi(s, actorId);
    const node = ui.get(Handles.chessPuzzleMovePlySelected);
    if (!(await node.isVisible())) return null;
    return stripProbe(await node.text());
  } catch {
    return null;
  }
}

export function waitPuzzleReviewReady(
  s: ProductSim,
  actorId: string
): Promise<PuzzleReviewProbe> {
  return pollUntil(
    s,
    async () => {
      const probe = await readPuzzleReviewProbe(s, actorId);
      return probe !== null && probe.lastSolveIdx > 0 ? probe : null;
    },
    { maxMs: WAIT_MS, stepMs: POLL_MS, description: 'review scrub probe' }
  );
}

/** Press one of the move-list scrub controls. */
export async function pressPuzzleNavControl(
  s: ProductSim,
  actorId: string,
  control: PuzzleNavControl
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.chessPuzzleMoveNav(control)).tap({ timeoutMs: WAIT_MS });
  await s.session.waitForIdle();
}

/** Tap a ply in the move list (0-based ply index). */
export async function tapPuzzleReviewPly(
  s: ProductSim,
  actorId: string,
  plyIndex: number
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.chessPuzzleMovePly(plyIndex))
    .tap({ timeoutMs: WAIT_MS });
  await s.session.waitForIdle();
}

/** Send a key to the app the way a person on a keyboard would. */
export async function pressPuzzleReviewKey(
  s: ProductSim,
  actorId: string,
  key: DriverKey
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.key(key);
  await s.session.waitForIdle();
}

/** Drag horizontally across the review board (left = forward, right = back). */
export async function swipePuzzleReviewBoard(
  s: ProductSim,
  actorId: string,
  direction: 'back' | 'forward'
): Promise<void> {
  const ui = await actorUi(s, actorId);
  const board = ui.get(Handles.chessPuzzleReviewBoard);
  await board.layout();
  const from = direction === 'forward' ? 0.85 : 0.15;
  const to = direction === 'forward' ? 0.15 : 0.85;
  await board.drag({ xRatio: from, yRatio: 0.5 }, { xRatio: to, yRatio: 0.5 });
  await s.session.waitForIdle();
}
