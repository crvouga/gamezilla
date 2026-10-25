import {
  applySokobanMove,
  initialSokobanPosition,
  SOKOBAN_ACTIONS,
  sokobanComplete,
} from './sokoban-position';
import {
  compareCells,
  SOKOBAN_DIRECTIONS,
  type SokobanBoard,
  type SokobanIssue,
  type SokobanPosition,
} from './sokoban-types';

export type SokobanSolution =
  /** A shortest-in-moves witness in LURD actions. */
  | { readonly status: 'solved'; readonly actions: readonly string[] }
  /** Only after every reachable position was examined within the budget. */
  | { readonly status: 'unsolvable' }
  /** The budget ran out first; nothing is claimed. */
  | { readonly status: 'inconclusive' }
  | { readonly status: 'invalid'; readonly issues: readonly SokobanIssue[] };

export type SokobanSolverOptions = {
  /** The most distinct positions (worker and crate squares) examined. */
  readonly maxStates: number;
};

type Visit = { readonly parent: string | null; readonly action: string };

/** Crates are interchangeable for search: the key ignores their indices. */
function positionKey(board: SokobanBoard, position: SokobanPosition): string {
  const crates = [...position.crates]
    .sort(compareCells)
    .map((crate) => crate.y * board.width + crate.x);
  return `${position.worker.y * board.width + position.worker.x}|${crates.join(',')}`;
}

function witness(visits: ReadonlyMap<string, Visit>, key: string): string[] {
  const actions: string[] = [];
  let at: string | null = key;
  while (at !== null) {
    const visit = visits.get(at);
    if (visit === undefined || visit.parent === null) break;
    actions.push(visit.action);
    at = visit.parent;
  }
  return actions.reverse();
}

/**
 * Deterministic breadth-first search over moves, so the first completed
 * position found is reached in the fewest moves.
 */
export function solveSokoban(
  board: SokobanBoard,
  options: SokobanSolverOptions
): SokobanSolution {
  const start = initialSokobanPosition(board);
  if (!start.valid) return { status: 'invalid', issues: start.issues };
  if (sokobanComplete(board, start.value))
    return { status: 'solved', actions: [] };
  if (!(options.maxStates >= 1)) return { status: 'inconclusive' };
  const startKey = positionKey(board, start.value);
  const visits = new Map<string, Visit>([
    [startKey, { parent: null, action: '' }],
  ]);
  const queue: { readonly key: string; readonly position: SokobanPosition }[] =
    [{ key: startKey, position: start.value }];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === undefined) break;
    for (const direction of SOKOBAN_DIRECTIONS) {
      const next = applySokobanMove(board, current.position, direction);
      if (!next.valid) continue;
      const key = positionKey(board, next.value);
      if (visits.has(key)) continue;
      visits.set(key, {
        parent: current.key,
        action: SOKOBAN_ACTIONS[direction],
      });
      if (sokobanComplete(board, next.value))
        return { status: 'solved', actions: witness(visits, key) };
      if (visits.size > options.maxStates) return { status: 'inconclusive' };
      queue.push({ key, position: next.value });
    }
  }
  return { status: 'unsolvable' };
}
