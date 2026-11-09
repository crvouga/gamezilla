import type { NumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-types';

/** Maximum board dimensions, with distinct labels sharing the same color. */
export const DENSE_NUMBERLINK: NumberlinkDefinition = {
  format: 1,
  width: 20,
  height: 20,
  coverage: 'all',
  pairs: Array.from({ length: 20 }, (_, row) => ({
    id: `row-${row}`,
    label: String(row + 1),
    color: 'blue',
    endpoints: [
      { x: 0, y: row },
      { x: 19, y: row },
    ],
  })),
};

/** Maximum label length; matching endpoints cannot be distinguished by color. */
export const LONG_LABEL_NUMBERLINK: NumberlinkDefinition = {
  format: 1,
  width: 5,
  height: 5,
  coverage: 'all',
  pairs: ['SUNRISES', 'MOONLITE', 'STARFALL', 'CLOUDTOP', 'RAINDROP'].map(
    (label, row) => ({
      id: `row-${row}`,
      label,
      color: 'blue',
      endpoints: [
        { x: 0, y: row },
        { x: 4, y: row },
      ],
    })
  ),
};
