import {
  QUORIDOR_MODES,
  type Quoridor,
  type QuoridorMode,
  quoridorCell,
  quoridorCellName,
  quoridorGoal,
} from './quoridor-geometry';
import { pawnMoves } from './quoridor-movement';
import { legalQuoridorWalls, wallRefusal } from './quoridor-walls';

export {
  QUORIDOR_MODES,
  type Quoridor,
  type QuoridorMode,
  quoridorCell,
  quoridorCellName,
  quoridorDistance,
  quoridorGoal,
  quoridorWall,
} from './quoridor-geometry';
export { pawnMoves } from './quoridor-movement';
export { type QuoridorWallRefusal, wallRefusal } from './quoridor-walls';

export function newQuoridor(mode: QuoridorMode): Quoridor {
  const config = QUORIDOR_MODES[mode];
  if (config === undefined) throw new Error('Unknown Quoridor mode');
  return {
    mode,
    pawns: [...config.starts],
    remaining: config.starts.map(() => config.walls),
    walls: [],
    turn: 0,
    winner: null,
    actions: [],
  };
}

export function playQuoridor(
  game: Quoridor,
  action: string,
  player = game.turn
): Quoridor | null {
  if (game.winner !== null || player !== game.turn) return null;
  if (action === 'pass') {
    if (!quoridorMustPass(game)) return null;
    return {
      ...game,
      turn: (player + 1) % game.pawns.length,
      actions: [...game.actions, action],
    };
  }
  const target = quoridorCell(action);
  if (
    target === null
      ? wallRefusal(game, action) !== null
      : !pawnMoves(game).includes(target)
  )
    return null;
  const pawns = [...game.pawns];
  const remaining = [...game.remaining];
  if (target !== null) pawns[player] = target;
  else remaining[player]!--;
  return {
    ...game,
    pawns,
    remaining,
    walls: target === null ? [...game.walls, action] : game.walls,
    turn: (player + 1) % pawns.length,
    winner:
      target !== null && quoridorGoal(game, player, target) ? player : null,
    actions: [...game.actions, action],
  };
}

export function legalQuoridorActions(game: Quoridor): readonly string[] {
  const actions = [
    ...pawnMoves(game).map(quoridorCellName),
    ...legalQuoridorWalls(game),
  ];
  return actions.length === 0 && game.mode === 'hill' && game.winner === null
    ? ['pass']
    : actions;
}

export function quoridorMustPass(game: Quoridor): boolean {
  return (
    game.mode === 'hill' &&
    game.winner === null &&
    pawnMoves(game).length === 0 &&
    legalQuoridorWalls(game).length === 0
  );
}

export function replayQuoridor(
  mode: QuoridorMode,
  actions: readonly string[],
  ply = actions.length
): Quoridor {
  if (!Number.isInteger(ply) || ply < 0 || ply > actions.length)
    throw new Error('Invalid Quoridor replay position');
  let game = newQuoridor(mode);
  for (const action of actions.slice(0, ply)) {
    const next = playQuoridor(game, action);
    if (next === null) throw new Error('Invalid Quoridor action history');
    game = next;
  }
  return game;
}

/** Accepted actions are the canonical position; untrusted snapshots cannot invent a pawn or wall. */
export function encodeQuoridor(game: Quoridor): string {
  return `quoridor:1:${game.mode}:${game.actions.join(',')}`;
}

export function decodeQuoridor(position: string): Quoridor {
  const match =
    /^quoridor:1:(classic|hill):((?:(?:[a-i][1-9][hv]?|pass)(?:,(?:[a-i][1-9][hv]?|pass))*)?)$/.exec(
      position
    );
  if (match === null) throw new Error('Invalid Quoridor position');
  return replayQuoridor(
    match[1] as QuoridorMode,
    match[2] === '' ? [] : match[2]!.split(',')
  );
}
