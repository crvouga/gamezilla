import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { PuzzleOutcomeKind } from './interaction-entities';

const result = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'puzzle', 'result');
export const PuzzleResultAttr = {
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
    ...PuzzleResultAttr.owner(owner),
    ...PuzzleResultAttr.attempt(attempt),
    ...PuzzleResultAttr.outcome(null),
    ...PuzzleResultAttr.score(null),
    ...PuzzleResultAttr.usedHint(false),
  };
}

/** The first result stays decided while the solver retries or reviews the board. */
export function decidePuzzleResult(
  state: RoomState,
  outcome: PuzzleOutcomeKind,
  score: 0 | 500 | 1000
): RoomState {
  if (PuzzleResultAttr.outcome.from(state) !== null) return {};
  return {
    ...PuzzleResultAttr.outcome(outcome),
    ...PuzzleResultAttr.score(score),
  };
}
