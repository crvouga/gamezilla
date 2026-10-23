import type {
  Cell,
  EndpointPair,
  NumberlinkDefinition,
} from '@libs/numberlink-shared-ts/numberlink-types';
import {
  inBounds,
  PAIR_COLORS,
  sameCell,
} from '@libs/numberlink-shared-ts/numberlink-types';

export function initialNumberlinkDefinition(): string {
  return JSON.stringify({
    format: 1,
    width: 3,
    height: 3,
    coverage: 'all',
    pairs: ['red', 'green', 'blue'].map((color, y) => ({
      id: `pair-${y + 1}`,
      label: String(y + 1),
      color,
      endpoints: [
        { x: 0, y },
        { x: 2, y },
      ],
    })),
  });
}

export function replaceNumberlinkPair(
  board: NumberlinkDefinition,
  pair: EndpointPair
): NumberlinkDefinition {
  return {
    ...board,
    pairs: board.pairs.map((current) =>
      current.id === pair.id ? pair : current
    ),
  };
}

export function resizedNumberlinkBoard(
  board: NumberlinkDefinition,
  size: { width: number; height: number }
): NumberlinkDefinition | null {
  const next = { ...board, ...size };
  return board.pairs.every((pair) =>
    pair.endpoints.every((at) => inBounds(next, at))
  )
    ? next
    : null;
}

export function withNewNumberlinkPair(
  board: NumberlinkDefinition,
  id: string
): NumberlinkDefinition | null {
  const open: Cell[] = [];
  for (let y = 0; y < board.height && open.length < 2; y++)
    for (let x = 0; x < board.width && open.length < 2; x++) {
      const cell = { x, y };
      if (
        !board.pairs.some((pair) =>
          pair.endpoints.some((at) => sameCell(at, cell))
        )
      )
        open.push(cell);
    }
  const first = open[0];
  const second = open[1];
  if (first === undefined || second === undefined) return null;
  let label = 1;
  while (board.pairs.some((pair) => pair.label === String(label))) label++;
  const color = PAIR_COLORS[board.pairs.length % PAIR_COLORS.length] ?? 'red';
  return {
    ...board,
    pairs: [
      ...board.pairs,
      { id, label: String(label), color, endpoints: [first, second] },
    ],
  };
}

export function movedNumberlinkEndpoint(
  board: NumberlinkDefinition,
  pair: EndpointPair,
  end: 0 | 1,
  cell: Cell
): NumberlinkDefinition | null {
  const occupied = board.pairs.some((other) =>
    other.endpoints.some(
      (at, index) =>
        (other.id !== pair.id || index !== end) && sameCell(at, cell)
    )
  );
  if (occupied) return null;
  const endpoints: readonly [Cell, Cell] =
    end === 0 ? [cell, pair.endpoints[1]] : [pair.endpoints[0], cell];
  return replaceNumberlinkPair(board, { ...pair, endpoints });
}
