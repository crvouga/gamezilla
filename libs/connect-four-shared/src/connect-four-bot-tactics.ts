import type { ConnectFour } from './connect-four';
import { dropDisc, legalColumns } from './connect-four';

function winningColumns(game: ConnectFour): number[] {
  return legalColumns(game).filter(
    (column) => dropDisc(game, column)?.result === game.turn
  );
}

/** Resolve immediate tactics through the canonical rules before bounded search. */
export function connectFourTacticalColumns(
  game: ConnectFour
): readonly number[] {
  const legal = legalColumns(game);
  const winning = winningColumns(game);
  if (winning.length > 0) return winning;
  const safe = legal.filter((column) => {
    const next = dropDisc(game, column);
    return next !== null && winningColumns(next).length === 0;
  });
  return safe.length > 0 ? safe : legal;
}
