import type {
  GameRules,
  GameSetups,
  PlayedPosition,
  PrivateSetupRules,
} from '@pkgs/turn-game-shared/game-rules';
import { isCell } from './battleship-board';
import {
  acceptFleet,
  parseFleet,
  randomFleet,
  shipAt,
} from './battleship-fleet';
import {
  BATTLESHIP_REASON,
  type BattleshipPosition,
  encodeBattleshipPosition,
  otherSide,
  parseShotAction,
  readBattleshipPosition,
  replayBattleship,
  type Shot,
  shotAction,
  shotLabel,
  untargetedCells,
} from './battleship-position';

export const BATTLESHIP_ID = 'battleship';

/**
 * The public shot `proposal` by the side to move resolves to against the
 * defender's hidden fleet, or `null` when it is refused.
 */
export function resolveBattleshipShot(
  position: string,
  proposal: string,
  setups: GameSetups
): string | null {
  const battle = readBattleshipPosition(position);
  if (battle === null || !isCell(proposal)) return null;
  if (!untargetedCells(battle).includes(proposal)) return null;
  const fleet = parseFleet(setups[otherSide(battle.turn)]);
  if (fleet === null) return null;
  const ship = shipAt(fleet, proposal);
  if (ship === null) return shotAction({ cell: proposal, outcome: 'miss' });
  const hit = new Set(
    battle.shots[battle.turn]
      .filter((shot) => shot.outcome !== 'miss')
      .map((shot) => shot.cell)
  );
  const sinks = ship.cells.every((cell) => cell === proposal || hit.has(cell));
  return shotAction(
    sinks
      ? { cell: proposal, outcome: 'sunk', ship: ship.ship }
      : { cell: proposal, outcome: 'hit' }
  );
}
export const battleshipSetupRules: PrivateSetupRules = {
  accept: acceptFleet,
  random: randomFleet,
  resolve: resolveBattleshipShot,
};
function played(next: BattleshipPosition, shot: Shot): PlayedPosition {
  return {
    position: encodeBattleshipPosition(next.actions),
    history: next.actions.join(','),
    turn: next.turn,
    label: shotLabel(shot),
    winner: next.winner,
    reason: next.winner === null ? null : BATTLESHIP_REASON,
  };
}
function requirePosition(position: string): BattleshipPosition {
  const battle = readBattleshipPosition(position);
  if (battle === null) throw new Error('Invalid Battleship position');
  return battle;
}
export const battleshipRules: GameRules = {
  id: BATTLESHIP_ID,
  setup: battleshipSetupRules,
  recognizes: (position) => readBattleshipPosition(position) !== null,
  initial: () => encodeBattleshipPosition([]),
  play(position, action) {
    const battle = readBattleshipPosition(position);
    const shot = parseShotAction(action);
    if (battle === null || shot === null || battle.winner !== null) return null;
    const next = replayBattleship([...battle.actions, action]);
    return next === null ? null : played(next, shot);
  },
  replay(actions, ply) {
    const battle = replayBattleship(actions.slice(0, ply));
    if (battle === null) throw new Error('Invalid Battleship action history');
    return encodeBattleshipPosition(battle.actions);
  },
  legal: (position) => {
    const battle = readBattleshipPosition(position);
    return battle === null ? [] : untargetedCells(battle);
  },
  canWin: (position, side) => {
    const winner = requirePosition(position).winner;
    return winner === null || winner === side;
  },
  moves(position) {
    const { actions } = requirePosition(position);
    return actions.map((action, index) => ({
      label: shotLabel(parseShotAction(action)!),
      before: encodeBattleshipPosition(actions.slice(0, index)),
      after: encodeBattleshipPosition(actions.slice(0, index + 1)),
    }));
  },
};
