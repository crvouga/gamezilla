import type {
  Cell,
  NumberlinkDefinition,
} from '@libs/numberlink-shared-ts/numberlink-types';

const TWO_ROWS: NumberlinkDefinition = {
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

export function numberlinkFixture(name: string): NumberlinkDefinition {
  const fixtures: Readonly<Record<string, NumberlinkDefinition>> = {
    'Two rows': TWO_ROWS,
    'Room below': { ...TWO_ROWS, height: 3 },
    'Endpoints only': { ...TWO_ROWS, height: 3, coverage: 'pairs' },
    Crossing: {
      format: 1,
      width: 3,
      height: 3,
      coverage: 'all',
      pairs: [
        {
          id: 'first',
          label: '1',
          color: 'red',
          endpoints: [
            { x: 0, y: 1 },
            { x: 2, y: 1 },
          ],
        },
        {
          id: 'second',
          label: '2',
          color: 'blue',
          endpoints: [
            { x: 1, y: 0 },
            { x: 1, y: 2 },
          ],
        },
      ],
    },
  };
  const definition = fixtures[name];
  if (definition === undefined)
    throw new Error(`Unknown Numberlink example: ${name}`);
  return definition;
}

export function numberedCells(text: string): Cell[] {
  if (text.length === 0) return [];
  return text.split(' ').map((name) => {
    const match = /^([A-T])([1-9]|1\d|20)$/.exec(name);
    if (match === null) throw new Error(`Unknown Numberlink cell: ${name}`);
    return { x: match[1]!.charCodeAt(0) - 65, y: Number(match[2]) - 1 };
  });
}

export function namedCells(cells: readonly Cell[]): string {
  return cells
    .map((cell) => `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`)
    .join(' ');
}
