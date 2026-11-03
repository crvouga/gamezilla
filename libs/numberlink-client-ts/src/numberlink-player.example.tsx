import type {
  Cell,
  NumberlinkDefinition,
  NumberlinkPath,
} from '@libs/numberlink-shared-ts/numberlink-types';

/** `[x, y]` pairs as cells. */
function cells(...points: readonly (readonly [number, number])[]): Cell[] {
  return points.map(([x, y]) => ({ x, y }));
}

/**
 * Story-only: a five-by-five puzzle whose five pairs fill every cell, and
 * the paths that solve it.
 *
 * ```
 * 1 1 1 1 2
 * 3 3 3 1 2
 * 4 4 3 1 2
 * 5 4 3 2 2
 * 5 5 5 5 5
 * ```
 */
export const FIVE_BY_FIVE: NumberlinkDefinition = {
  format: 1,
  width: 5,
  height: 5,
  coverage: 'all',
  pairs: [
    {
      id: 'pair-1',
      label: '1',
      color: 'red',
      endpoints: [
        { x: 0, y: 0 },
        { x: 3, y: 2 },
      ],
    },
    {
      id: 'pair-2',
      label: '2',
      color: 'orange',
      endpoints: [
        { x: 4, y: 0 },
        { x: 3, y: 3 },
      ],
    },
    {
      id: 'pair-3',
      label: '3',
      color: 'yellow',
      endpoints: [
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ],
    },
    {
      id: 'pair-4',
      label: '4',
      color: 'green',
      endpoints: [
        { x: 0, y: 2 },
        { x: 1, y: 3 },
      ],
    },
    {
      id: 'pair-5',
      label: '5',
      color: 'blue',
      endpoints: [
        { x: 0, y: 3 },
        { x: 4, y: 4 },
      ],
    },
  ],
};

/** Pair 1's path, along the top and down to its second endpoint. */
export const PATH_1: NumberlinkPath = {
  pairId: 'pair-1',
  cells: cells([0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]),
};
const PATH_2: NumberlinkPath = {
  pairId: 'pair-2',
  cells: cells([4, 0], [4, 1], [4, 2], [4, 3], [3, 3]),
};
/** Pair 3's path, across the second row and down the middle. */
export const PATH_3: NumberlinkPath = {
  pairId: 'pair-3',
  cells: cells([0, 1], [1, 1], [2, 1], [2, 2], [2, 3]),
};
/** Pair 4's path, a short hook. */
export const PATH_4: NumberlinkPath = {
  pairId: 'pair-4',
  cells: cells([0, 2], [1, 2], [1, 3]),
};
const PATH_5: NumberlinkPath = {
  pairId: 'pair-5',
  cells: cells([0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]),
};

export const SOLUTION: readonly NumberlinkPath[] = [
  PATH_1,
  PATH_2,
  PATH_3,
  PATH_4,
  PATH_5,
];
