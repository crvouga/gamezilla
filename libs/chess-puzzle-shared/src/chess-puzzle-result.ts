import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { RoomState } from '@pkgs/room-root-shared/types';
import type { ChessPuzzleOutcomeKind } from './chess-puzzle-interaction-entities';

const result = createAttrNamespace('chess', 'puzzle', 'result');
export const ChessPuzzleResultAttr = {
  attempt: result.textOrNull('attempt', (v) =>
    typeof v === 'string' && v.length > 0 ? v : null
  ),
  owner: result.textOrNull('owner', (v) =>
    typeof v === 'string' && v.length > 0 ? v : null
  ),
  outcome: result.enumOrNull('outcome', [
    'solved',
    'failed',
    'abandoned',
  ] as const),
  score: result.integerOrNull('score', (v) =>
    v === 0 || v === 500 || v === 1000 ? v : null
  ),
  usedHint: result.boolean('used-hint', (v) => v === true),
};

export function startPuzzleResult(
  owner: string | null,
  attempt: string | null
): RoomState {
  return {
    ...ChessPuzzleResultAttr.owner(owner),
    ...ChessPuzzleResultAttr.attempt(attempt),
    ...ChessPuzzleResultAttr.outcome(null),
    ...ChessPuzzleResultAttr.score(null),
    ...ChessPuzzleResultAttr.usedHint(false),
  };
}

/** The first result stays decided while the solver retries or reviews the board. */
export function decidePuzzleResult(
  state: RoomState,
  outcome: ChessPuzzleOutcomeKind,
  score: 0 | 500 | 1000
): RoomState {
  if (ChessPuzzleResultAttr.outcome.from(state) !== null) return {};
  return {
    ...ChessPuzzleResultAttr.outcome(outcome),
    ...ChessPuzzleResultAttr.score(score),
  };
}
