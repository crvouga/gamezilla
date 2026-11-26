import {
  type Quoridor,
  quoridorCellName,
} from '@libs/quoridor-shared-ts/quoridor';
import type { BoardMove } from '@pkgs/quoridor-board-client-ts/surface';
import { type Accessor, createMemo } from 'solid-js';

function nextMove(
  before: Quoridor | undefined,
  after: Quoridor
): BoardMove | null {
  if (
    !before ||
    before.mode !== after.mode ||
    before.actions.length + 1 !== after.actions.length ||
    !before.actions.every((action, index) => action === after.actions[index])
  )
    return null;
  const action = after.actions.at(-1);
  if (!action || action === 'pass') return null;
  if (action.length === 3)
    return {
      kind: 'wall',
      anchor: action.slice(0, 2),
      horizontal: action.endsWith('h'),
    };
  const from = before.pawns[before.turn];
  return from === undefined
    ? null
    : { kind: 'pawn', from: quoridorCellName(from), to: action };
}

export function createQuoridorTransition(game: Accessor<Quoridor>) {
  return createMemo<{ game: Quoridor; move: BoardMove | null }>((previous) => {
    const current = game();
    return { game: current, move: nextMove(previous?.game, current) };
  });
}
