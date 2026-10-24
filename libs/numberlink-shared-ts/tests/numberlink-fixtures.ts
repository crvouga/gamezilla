import type {
  Cell,
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';

export const TWO_ROWS: NumberlinkDefinition = {
  format: 1,
  width: 3,
  height: 2,
  coverage: 'all',
  pairs: [
    {
      id: 'first',
      label: '1',
      color: 'red',
      endpoints: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    },
    {
      id: 'second',
      label: '2',
      color: 'blue',
      endpoints: [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
    },
  ],
};

export const TWO_ROWS_SOLUTION: NumberlinkState = {
  paths: [
    {
      pairId: 'first',
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    },
    {
      pairId: 'second',
      cells: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
    },
  ],
};

/** Every row is an independent known solution, regardless of width or height. */
export function rowBoard(
  width: number,
  height: number
): {
  readonly definition: NumberlinkDefinition;
  readonly solution: NumberlinkState;
} {
  const rows = Array.from({ length: height }, (_, y) => y);
  return {
    definition: {
      format: 1,
      width,
      height,
      coverage: 'all',
      pairs: rows.map((y) => ({
        id: `row-${y}`,
        label: String(y + 1),
        color: 'green',
        endpoints: [
          { x: 0, y },
          { x: width - 1, y },
        ],
      })),
    },
    solution: {
      paths: rows.map((y) => ({
        pairId: `row-${y}`,
        cells: Array.from({ length: width }, (_, x) => ({ x, y })),
      })),
    },
  };
}

/** Independent small-board enumerator: no product traversal or validation. */
export function oracleSolutions(definition: NumberlinkDefinition): number {
  let count = 0;
  const area = definition.width * definition.height;
  const index = (cell: Cell) => cell.y * definition.width + cell.x;
  const endpoints = new Map(
    definition.pairs.flatMap((pair) =>
      pair.endpoints.map((cell) => [index(cell), pair.id] as const)
    )
  );
  function nextPair(pairIndex: number, occupied: ReadonlySet<number>): void {
    const pair = definition.pairs[pairIndex];
    if (pair === undefined) {
      if (definition.coverage === 'pairs' || occupied.size === area) count++;
      return;
    }
    const target = index(pair.endpoints[1]);
    const pairId = pair.id;
    function extend(current: number, visited: ReadonlySet<number>): void {
      if (current === target) {
        nextPair(pairIndex + 1, visited);
        return;
      }
      for (let candidate = 0; candidate < area; candidate++) {
        const dx = Math.abs(
          (current % definition.width) - (candidate % definition.width)
        );
        const dy = Math.abs(
          Math.floor(current / definition.width) -
            Math.floor(candidate / definition.width)
        );
        if (dx + dy !== 1 || visited.has(candidate)) continue;
        const owner = endpoints.get(candidate);
        if (owner !== undefined && owner !== pairId) continue;
        extend(candidate, new Set([...visited, candidate]));
      }
    }
    const first = index(pair.endpoints[0]);
    extend(first, new Set([...occupied, first]));
  }
  nextPair(0, new Set());
  return count;
}
