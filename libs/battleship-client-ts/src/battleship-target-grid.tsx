import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, For, type JSX, Show } from 'solid-js';
import { COLUMN_LABELS, ROW_LABELS } from './battleship-copy';

/** Four bounded five-by-five areas keep every coordinate reachable at a larger size. */
export function BattleshipTargetGrid(props: {
  label: string;
  testId: string;
  cells: readonly CellGridCell[];
  onAim: (cell: string) => void;
}): JSX.Element {
  const [large, setLarge] = createSignal(false);
  const [area, setArea] = createSignal(0);
  const columns = () =>
    large()
      ? COLUMN_LABELS.slice((area() % 2) * 5, (area() % 2) * 5 + 5)
      : COLUMN_LABELS;
  const rows = () =>
    large()
      ? ROW_LABELS.slice(
          Math.floor(area() / 2) * 5,
          Math.floor(area() / 2) * 5 + 5
        )
      : ROW_LABELS;
  const cells = () =>
    props.cells.filter(
      (cell) =>
        columns().includes(cell.id[0]?.toUpperCase() ?? '') &&
        rows().includes(cell.id.slice(1))
    );
  return (
    <StackVertical gap="sm" width="full">
      <CellGridBoard
        fill={!large()}
        label={props.label}
        testId={`${props.testId}-target-grid`}
        cellTestId={(cell) => `${props.testId}-target-${cell}`}
        columnLabels={columns()}
        rowLabels={rows()}
        cells={cells()}
        onActivate={props.onAim}
      />
      <Button
        title={large() ? t`Show whole board` : t`Larger targets`}
        onClick={() => setLarge(!large())}
        dataSet={{ testid: `${props.testId}-large-targets` }}
      />
      <Show when={large()}>
        <Grid columns={2} gap="xs">
          <For each={['A1–E5', 'F1–J5', 'A6–E10', 'F6–J10']}>
            {(label, index) => (
              <Button
                title={label}
                variant={area() === index() ? 'solid' : 'outline'}
                onClick={() => setArea(index())}
                dataSet={{ testid: `${props.testId}-area-${index()}` }}
              />
            )}
          </For>
        </Grid>
      </Show>
    </StackVertical>
  );
}
