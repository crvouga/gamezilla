export const QUORIDOR_SIZE = 9;
export type QuoridorMode = 'classic' | 'hill';
export type QuoridorWall = {
  readonly x: number;
  readonly y: number;
  readonly direction: 'h' | 'v';
};
export type Quoridor = {
  readonly mode: QuoridorMode;
  readonly pawns: readonly number[];
  readonly remaining: readonly number[];
  readonly walls: readonly string[];
  readonly turn: number;
  readonly winner: number | null;
  readonly actions: readonly string[];
};
export const QUORIDOR_MODES = {
  classic: { starts: [4, 76], walls: 10, goal: 'opposite-row' },
  hill: { starts: [4, 36, 76, 44], walls: 5, goal: 'center' },
} as const;

export function quoridorCell(cell: string): number | null {
  if (!/^[a-i][1-9]$/.test(cell)) return null;
  return cell.charCodeAt(0) - 97 + (Number(cell[1]) - 1) * QUORIDOR_SIZE;
}

export function quoridorCellName(cell: number): string {
  if (!Number.isInteger(cell) || cell < 0 || cell >= 81)
    throw new Error('Invalid Quoridor square');
  return `${String.fromCharCode(97 + (cell % 9))}${Math.floor(cell / 9) + 1}`;
}

export function quoridorWall(action: string): QuoridorWall | null {
  if (!/^[a-h][1-8][hv]$/.test(action)) return null;
  return {
    x: action.charCodeAt(0) - 97,
    y: Number(action[1]) - 1,
    direction: action[2] as 'h' | 'v',
  };
}

export function quoridorGoal(
  game: Quoridor,
  player: number,
  cell: number
): boolean {
  return QUORIDOR_MODES[game.mode].goal === 'center'
    ? cell === 40
    : Math.floor(cell / 9) === (player === 0 ? 8 : 0);
}

export function quoridorNeighbor(
  cell: number,
  dx: number,
  dy: number
): number | null {
  const x = (cell % 9) + dx;
  const y = Math.floor(cell / 9) + dy;
  return x < 0 || x >= 9 || y < 0 || y >= 9 ? null : y * 9 + x;
}

export const QUORIDOR_DIRECTIONS = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
] as const;

type Goal = 'hill' | 'north' | 'south';
type WallTopology = {
  readonly blocked: Uint8Array;
  readonly distances: Partial<Record<Goal, Int16Array>>;
};

const NEIGHBORS = Int16Array.from(
  Array.from({ length: 81 }, (_, cell) =>
    QUORIDOR_DIRECTIONS.map(([dx, dy]) => quoridorNeighbor(cell, dx, dy) ?? -1)
  ).flat()
);
const GOALS = {
  hill: [40],
  north: Array.from({ length: 9 }, (_, column) => 72 + column),
  south: Array.from({ length: 9 }, (_, column) => column),
} as const;
const TOPOLOGIES = new WeakMap<readonly string[], WallTopology>();
/** Candidate walls are rebuilt during legality checks and bot scoring; retain only a bounded working set. */
const RECENT_TOPOLOGIES = new Map<string, WallTopology>();
const MAX_RECENT_TOPOLOGIES = 256;

function buildTopology(walls: readonly string[]): WallTopology {
  const blocked = new Uint8Array(81);
  for (const action of walls) {
    const wall = quoridorWall(action)!;
    const start = wall.y * 9 + wall.x;
    const horizontal = wall.direction === 'h';
    const across = horizontal ? 9 : 1;
    const along = horizontal ? 1 : 9;
    const direction = horizontal ? 0 : 3;
    for (const from of [start, start + along]) {
      const to = from + across;
      blocked[from] = blocked[from]! | (1 << direction);
      blocked[to] = blocked[to]! | (1 << ((direction + 2) % 4));
    }
  }
  return { blocked, distances: {} };
}

function topology(walls: readonly string[]): WallTopology {
  const held = TOPOLOGIES.get(walls);
  if (held !== undefined) return held;
  const key = walls.join(',');
  const recent = RECENT_TOPOLOGIES.get(key) ?? buildTopology(walls);
  RECENT_TOPOLOGIES.delete(key);
  RECENT_TOPOLOGIES.set(key, recent);
  if (RECENT_TOPOLOGIES.size > MAX_RECENT_TOPOLOGIES)
    RECENT_TOPOLOGIES.delete(RECENT_TOPOLOGIES.keys().next().value!);
  TOPOLOGIES.set(walls, recent);
  return recent;
}

/** One reverse breadth-first search supplies every pawn and candidate square's exact distance. */
function distanceField(board: WallTopology, goal: Goal): Int16Array {
  const held = board.distances[goal];
  if (held !== undefined) return held;
  const distances = new Int16Array(81).fill(-1);
  const queue = new Int16Array(81);
  let tail = 0;
  for (const cell of GOALS[goal]) {
    distances[cell] = 0;
    queue[tail++] = cell;
  }
  for (let head = 0; head < tail; head++) {
    const cell = queue[head]!;
    for (let direction = 0; direction < 4; direction++) {
      const next = NEIGHBORS[cell * 4 + direction]!;
      if (
        next < 0 ||
        distances[next]! >= 0 ||
        (board.blocked[cell]! & (1 << direction)) !== 0
      )
        continue;
      distances[next] = distances[cell]! + 1;
      queue[tail++] = next;
    }
  }
  board.distances[goal] = distances;
  return distances;
}

export function quoridorConnected(
  walls: readonly string[],
  a: number,
  b: number
): boolean {
  const ax = a % 9;
  const ay = Math.floor(a / 9);
  const bx = b % 9;
  const by = Math.floor(b / 9);
  if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return false;
  const direction = by > ay ? 0 : bx < ax ? 1 : by < ay ? 2 : 3;
  return (topology(walls).blocked[a]! & (1 << direction)) === 0;
}

/** Distance ignores temporary pawn occupancy, as required when preserving paths. */
export function quoridorDistance(
  game: Quoridor,
  player: number,
  start = game.pawns[player]!
): number {
  const goal = game.mode === 'hill' ? 'hill' : player === 0 ? 'north' : 'south';
  const distance = distanceField(topology(game.walls), goal)[start] ?? -1;
  return distance < 0 ? Infinity : distance;
}
