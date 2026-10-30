/** @jsxImportSource solid-js */

import {
  TileBoard,
  type TileBoardDirection,
  type TileBoardTile,
} from '@pkgs/ui-root-client-ts/tile-board';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const COLUMNS = 6;
const ROWS = 4;
const LAYOUT = ['######', '#    #', '#  ..#', '######'];
const STEP: Readonly<Record<TileBoardDirection, [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const terrainAt = (column: number, row: number) =>
  LAYOUT[row]?.[column] === '#' ? 'solid' : 'open';

/** A walled room: steer the ring-bearer with arrows, W A S D, swipes or taps. */
export default function TileBoardExample(): JSX.Element {
  const [at, setAt] = createSignal({ column: 1, row: 1 });
  const move = (direction: TileBoardDirection): void => {
    const [dx, dy] = STEP[direction];
    const next = { column: at().column + dx, row: at().row + dy };
    if (terrainAt(next.column, next.row) === 'open') setAt(next);
  };
  const tiles = (): readonly TileBoardTile[] =>
    Array.from({ length: COLUMNS * ROWS }, (_, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const marked = LAYOUT[row]?.[column] === '.';
      return {
        terrain: terrainAt(column, row),
        marked,
        label: `${String.fromCharCode(65 + column)}${row + 1}: ${
          terrainAt(column, row) === 'solid' ? 'wall' : marked ? 'mark' : 'open'
        }`,
      };
    });
  return (
    <ExampleRoot>
      <TileBoard
        label="Example room. Use the arrow keys to move."
        testId="example-tile-board"
        columns={COLUMNS}
        rows={ROWS}
        tiles={tiles()}
        pieces={[
          { id: 'box', column: 4, row: 2, glyph: '▣', tone: 'settled' },
          { id: 'walker', ...at(), glyph: '☻', tone: 'actor' },
        ]}
        onDirection={move}
        onTile={(index) => {
          const column = index % COLUMNS;
          const row = Math.floor(index / COLUMNS);
          if (Math.abs(column - at().column) + Math.abs(row - at().row) === 1)
            move(
              column > at().column
                ? 'right'
                : column < at().column
                  ? 'left'
                  : row > at().row
                    ? 'down'
                    : 'up'
            );
        }}
      />
    </ExampleRoot>
  );
}
