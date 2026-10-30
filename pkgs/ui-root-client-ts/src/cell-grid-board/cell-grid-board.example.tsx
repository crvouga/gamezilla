/** @jsxImportSource solid-js */

import {
  CellGridBoard,
  type CellGridCell,
  type CellGridTone,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { PairedPanels } from '@pkgs/ui-root-client-ts/paired-panels';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const COLUMNS = ['A', 'B', 'C', 'D', 'E'];
const ROWS = ['1', '2', '3', '4'];
type Mark = { tone: CellGridTone; glyph: string; word: string };
const EMPTY: Mark = { tone: 'open', glyph: '', word: 'empty' };
const MARKS: readonly Mark[] = [
  EMPTY,
  { tone: 'occupied', glyph: '■', word: 'taken' },
  { tone: 'quiet', glyph: '•', word: 'passed' },
  { tone: 'alert', glyph: '✕', word: 'flagged' },
  { tone: 'critical', glyph: '✖', word: 'closed' },
];

function cells(marks: readonly number[]): readonly CellGridCell[] {
  return marks.map((mark, index) => {
    const id = `${COLUMNS[index % 5]}${ROWS[Math.floor(index / 5)]}`;
    const look = MARKS[mark] ?? EMPTY;
    return {
      id: id.toLowerCase(),
      glyph: look.glyph,
      tone: look.tone,
      enabled: true,
      label: `${id}: ${look.word}`,
      identity:
        mark === 0
          ? undefined
          : (['one', 'two', 'three', 'four'] as const)[mark - 1],
      edges: index === 3 || index === 8 ? ['right'] : [],
      previewEdges: index === 12 ? ['bottom'] : [],
    };
  });
}
function MarkingGrid(props: { label: string; testId: string }): JSX.Element {
  const [marks, setMarks] = createSignal<readonly number[]>(
    Array.from({ length: 20 }, (_, index) => index % 5)
  );
  return (
    <CellGridBoard
      label={props.label}
      testId={props.testId}
      columnLabels={COLUMNS}
      rowLabels={ROWS}
      cells={cells(marks())}
      onActivate={(id) =>
        setMarks((current) =>
          current.map((mark, index) =>
            cells(current)[index]?.id === id ? (mark + 1) % 5 : mark
          )
        )
      }
    />
  );
}

/** Two labelled grids that cycle a cell's mark when it is pressed. */
export default function CellGridBoardExample(): JSX.Element {
  const [selected, setSelected] = createSignal<'left' | 'right'>('left');
  return (
    <ExampleRoot>
      <PairedPanels
        label="Grids"
        testId="example-grids"
        keys={['left', 'right']}
        labels={{ left: 'First grid', right: 'Second grid' }}
        selected={selected()}
        onSelect={setSelected}
        first={<MarkingGrid label="First grid" testId="example-first" />}
        second={<MarkingGrid label="Second grid" testId="example-second" />}
      />
    </ExampleRoot>
  );
}
