export type BattleshipSide = 'white' | 'black';

import {
  CELLS,
  cellLabel,
  FLEET_CELL_COUNT,
  SHIP_IDS,
  type ShipId,
  shipLength,
} from './battleship-board';

/**
 * The public position is the versioned log of resolved shots,
 * `bs:1:<action>,<action>,…`, white's shots at even plies. A shot is
 * public once fired: `<cell>:miss`, `<cell>:hit` or `<cell>:sunk:<ship>`.
 * No fleet ever appears in a position.
 */
export const BATTLESHIP_PREFIX = 'bs:1:';
export const BATTLESHIP_REASON = 'fleet sunk';
/** Each side shoots each of the 100 cells at most once. */
const MAX_ACTIONS = 2 * CELLS.length;
export type ShotOutcome = 'miss' | 'hit' | 'sunk';
export type Shot = {
  readonly cell: string;
  readonly outcome: ShotOutcome;
  /** The ship sunk by a `sunk` shot. */
  readonly ship?: ShipId;
};
/** The finite shot vocabulary, shared immutably across history replays. */
const SHOTS = new Map<string, Shot>(
  CELLS.flatMap((cell) => {
    const shots: Shot[] = [
      { cell, outcome: 'miss' },
      { cell, outcome: 'hit' },
      ...SHIP_IDS.map((ship): Shot => ({ cell, outcome: 'sunk', ship })),
    ];
    return shots.map((shot): [string, Shot] => [
      shotAction(shot),
      Object.freeze(shot),
    ]);
  })
);
export type BattleshipPosition = {
  readonly actions: readonly string[];
  /** Each side's shots at the other side's board, in the order fired. */
  readonly shots: Readonly<Record<BattleshipSide, readonly Shot[]>>;
  /** The side to move (white when the number of shots is even). */
  readonly turn: BattleshipSide;
  readonly winner: BattleshipSide | null;
};
/** What one side's shots have established so far. */
type Volley = {
  readonly shots: Shot[];
  readonly targeted: Set<string>;
  hits: number;
  readonly sunk: Set<ShipId>;
  sunkLength: number;
};

export function otherSide(side: BattleshipSide): BattleshipSide {
  return side === 'white' ? 'black' : 'white';
}
/** The shot one public action records, or `null` unless it is one. */
export function parseShotAction(action: string): Shot | null {
  return SHOTS.get(action) ?? null;
}
/** The public action spelling `shot`. */
export function shotAction(shot: Shot): string {
  return shot.outcome === 'sunk'
    ? `${shot.cell}:sunk:${shot.ship}`
    : `${shot.cell}:${shot.outcome}`;
}
/** How a move list names `shot`: `E5 miss`, `E5 hit`, `E5 sinks the cruiser`. */
export function shotLabel(shot: Shot): string {
  const cell = cellLabel(shot.cell);
  return shot.outcome === 'sunk'
    ? `${cell} sinks the ${shot.ship}`
    : `${cell} ${shot.outcome}`;
}
function emptyVolley(): Volley {
  return {
    shots: [],
    targeted: new Set(),
    hits: 0,
    sunk: new Set(),
    sunkLength: 0,
  };
}
/**
 * Whether `shot` can follow `volley` on some fleet: a fresh cell, each ship
 * sunk once, never more hits than the fleet's 17 cells, never more sunk
 * length than hits, and the 17th hit exactly when the fifth ship sinks.
 */
function consistent(volley: Volley, shot: Shot): boolean {
  if (volley.targeted.has(shot.cell)) return false;
  if (shot.outcome === 'miss') return true;
  const hits = volley.hits + 1;
  if (hits > FLEET_CELL_COUNT) return false;
  const sinks = shot.ship;
  if (sinks !== undefined && volley.sunk.has(sinks)) return false;
  const sunkCount = volley.sunk.size + (sinks === undefined ? 0 : 1);
  const sunkLength =
    volley.sunkLength + (sinks === undefined ? 0 : shipLength(sinks));
  if (sunkLength > hits) return false;
  return (sunkCount === SHIP_IDS.length) === (hits === FLEET_CELL_COUNT);
}
function record(volley: Volley, shot: Shot): void {
  volley.shots.push(shot);
  volley.targeted.add(shot.cell);
  if (shot.outcome === 'miss') return;
  volley.hits += 1;
  if (shot.ship === undefined) return;
  volley.sunk.add(shot.ship);
  volley.sunkLength += shipLength(shot.ship);
}
type Replayed = {
  readonly volleys: Readonly<Record<BattleshipSide, Volley>>;
  readonly winner: BattleshipSide | null;
};
function replayVolleys(actions: readonly string[]): Replayed | null {
  if (actions.length > MAX_ACTIONS) return null;
  const volleys = { white: emptyVolley(), black: emptyVolley() };
  let winner: BattleshipSide | null = null;
  for (const [ply, action] of actions.entries()) {
    const shot = parseShotAction(action);
    const attacker: BattleshipSide = ply % 2 === 0 ? 'white' : 'black';
    const volley = volleys[attacker];
    if (winner !== null || shot === null || !consistent(volley, shot))
      return null;
    record(volley, shot);
    if (volley.sunk.size === SHIP_IDS.length) winner = attacker;
  }
  return { volleys, winner };
}
/** The position after `actions`, or `null` when any of them is refused. */
export function replayBattleship(
  actions: readonly string[]
): BattleshipPosition | null {
  const replayed = replayVolleys(actions);
  if (replayed === null) return null;
  return {
    actions: [...actions],
    shots: {
      white: replayed.volleys.white.shots,
      black: replayed.volleys.black.shots,
    },
    turn: actions.length % 2 === 0 ? 'white' : 'black',
    winner: replayed.winner,
  };
}
/** The actions `position` spells, or `null` unless it is a Battleship position. */
function positionActions(position: string): readonly string[] | null {
  if (!position.startsWith(BATTLESHIP_PREFIX)) return null;
  const body = position.slice(BATTLESHIP_PREFIX.length);
  return body === '' ? [] : body.split(',');
}
/** The decoded `position`, or `null` unless it is a well-formed Battleship position. */
export function readBattleshipPosition(
  position: string
): BattleshipPosition | null {
  const actions = positionActions(position);
  return actions === null ? null : replayBattleship(actions);
}
/** The decoded `position`; throws unless it is a well-formed Battleship position. */
export function decodeBattleshipPosition(position: string): BattleshipPosition {
  const battle = readBattleshipPosition(position);
  if (battle === null) throw new Error('Invalid Battleship position');
  return battle;
}
export function encodeBattleshipPosition(actions: readonly string[]): string {
  return BATTLESHIP_PREFIX + actions.join(',');
}
/** The cells the side to move has not shot yet, row-major; none once finished. */
export function untargetedCells(battle: BattleshipPosition): readonly string[] {
  if (battle.winner !== null) return [];
  const targeted = new Set(battle.shots[battle.turn].map((shot) => shot.cell));
  return CELLS.filter((cell) => !targeted.has(cell));
}
