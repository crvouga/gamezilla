import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import { createMemo, type JSX } from 'solid-js';

const COLUMNS = 7;
const ROWS = 6;

type Cell = 0 | 1 | 2;

/**
 * The cells a list of drops fills, discs alternating from 1. Rows count from
 * the bottom, as `DiscDropBoard` reads them: a drop lands in its column's
 * lowest empty row.
 */
function dropAll(moves: readonly number[]): {
  readonly cells: readonly Cell[];
  readonly last: number | undefined;
} {
  const cells: Cell[] = Array.from({ length: COLUMNS * ROWS }, () => 0);
  let last: number | undefined;
  moves.forEach((column, index) => {
    for (let row = 0; row < ROWS; row += 1) {
      const cell = row * COLUMNS + column;
      if (cells[cell] !== 0) continue;
      cells[cell] = index % 2 === 0 ? 1 : 2;
      last = cell;
      return;
    }
  });
  return { cells, last };
}

/**
 * Story-only: a Connect Four position drawn with the design-system board
 * Connect Four's own client draws (`DiscDropBoard`). Shared game packages
 * may not import a concrete game (`import-game-implementation.grit`), so
 * the position is replayed here from its drops, columns counted from 0.
 */
export function ConnectFourStoryBoard(props: {
  readonly moves: readonly number[];
  readonly interactive?: boolean | undefined;
  /** The four cells of a finished line, bottom row first. */
  readonly winning?: readonly number[] | undefined;
}): JSX.Element {
  const board = createMemo(() => dropAll(props.moves));
  const turn = (): 1 | 2 => (props.moves.length % 2 === 0 ? 1 : 2);
  return (
    <DiscDropBoard
      testId="custom-game-board"
      columnTestId={(column) => `custom-game-board-column-${column + 1}`}
      cells={board().cells}
      columns={COLUMNS}
      rows={ROWS}
      active={turn()}
      winning={props.winning ?? []}
      lastCell={board().last}
      interactive={props.interactive === true && props.winning === undefined}
      label="Connect Four board, seven columns and six rows"
      cellLabel={(column, row, disc) => {
        const identity =
          disc === 1 ? 'Red circle' : disc === 2 ? 'Yellow diamond' : 'Empty';
        return `Column ${column + 1}, row ${row + 1}: ${identity}`;
      }}
      columnLabel={(column, occupied, full) =>
        full
          ? `Column ${column + 1}, full`
          : `Column ${column + 1}, ${occupied} of 6 occupied`
      }
      onDrop={() => undefined}
    />
  );
}
