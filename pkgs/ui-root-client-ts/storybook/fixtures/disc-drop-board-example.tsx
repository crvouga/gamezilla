import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import { createSignal, type JSX } from 'solid-js';
/** Deliberately different dimensions exercise the presentation contract. */
export function DiscDropBoardExample(props: {
  interactive: boolean;
}): JSX.Element {
  const [cells, setCells] = createSignal([1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0]);
  const [active, setActive] = createSignal(1);
  const [last, setLast] = createSignal<number>();
  const drop = (column: number): void => {
    const next = [...cells()];
    const cell = next.findIndex(
      (disc, index) => index % 4 === column && disc === 0
    );
    if (cell < 0) return;
    next[cell] = active();
    setCells(next);
    setLast(cell);
    setActive(3 - active());
  };
  return (
    <DiscDropBoard
      cells={cells()}
      columns={4}
      rows={3}
      active={active()}
      winning={[]}
      interactive={props.interactive}
      lastCell={last()}
      label="Drop board"
      testId="arena-disc-board"
      columnTestId={(column) => `arena-column-${column + 1}`}
      cellLabel={(column, row, disc) =>
        `Column ${column + 1}, row ${row + 1}: ${disc === 0 ? 'Empty' : disc === 1 ? 'Circle' : 'Diamond'}`
      }
      columnLabel={(column, occupied, full) =>
        `Column ${column + 1}, ${occupied} discs${full ? ', full' : ''}`
      }
      onDrop={drop}
    />
  );
}
