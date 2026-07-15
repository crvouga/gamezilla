import type { SharedValue } from 'react-native-reanimated';
import type { DropOutcome } from './chess-board-drop-handler';
import { squarePieceCenter } from './chess-board-geometry';
import { snapPieceLayout } from './chess-board-piece-layout-registry';
import { markChessPerf } from './chess-board-perf';
import type { BoardOrientation, Square } from './chess-board-types';
import type { TryMoveOk } from './use-chess-game';

export type PanEndDeps = {
  setDragFrom: (sq: Square | null) => void;
  setSelected: (sq: Square | null) => void;
  applyDropRules: (from: Square, to: Square) => DropOutcome;
  commitDropUi: (result: TryMoveOk) => void;
  clearHover: () => void;
  markSnap: (pieceKey: number) => void;
  clearDragVisual: () => void;
  size: number;
  orientation: BoardOrientation;
  legalMarkersOpacity: SharedValue<number>;
};

function scheduleAfterPointer(fn: () => void): void {
  requestAnimationFrame(fn);
}

function cancelPan(deps: PanEndDeps): false {
  deps.setDragFrom(null);
  deps.clearDragVisual();
  return false;
}

function finishNonApplied(
  deps: PanEndDeps,
  outcome: Extract<DropOutcome, { kind: 'promotion' | 'illegal' }>
): boolean {
  deps.setDragFrom(null);
  if (outcome.kind === 'promotion') deps.setSelected(null);
  deps.clearDragVisual();
  return outcome.kind === 'promotion';
}

function scheduleAppliedCommit(
  deps: PanEndDeps,
  result: TryMoveOk,
  pieceKey: number
): void {
  scheduleAfterPointer(() => {
    deps.commitDropUi(result);
    deps.setDragFrom(null);
    deps.setSelected(null);
    deps.markSnap(pieceKey);
  });
}

/** Sync pointer-up work: rules + SharedValue snap. React/UI deferred to rAF. */
export function runPanEnd(
  deps: PanEndDeps,
  from: Square,
  to: Square | null,
  pieceKey: number
): boolean {
  deps.clearHover();
  deps.legalMarkersOpacity.value = 0;
  markChessPerf('chess-drop');
  if (to === null || to === from) return cancelPan(deps);

  const outcome = deps.applyDropRules(from, to);
  if (outcome.kind === 'promotion' || outcome.kind === 'illegal') {
    return finishNonApplied(deps, outcome);
  }

  const center = squarePieceCenter(to, deps.size, deps.orientation);
  snapPieceLayout(pieceKey, center.x, center.y);
  deps.clearDragVisual();
  scheduleAppliedCommit(deps, outcome.result, pieceKey);
  return true;
}
