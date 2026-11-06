import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, type JSX, Show } from 'solid-js';
import { COLUMN_LABELS, ROW_LABELS } from './battleship-copy';

/** Four bounded five-by-five areas keep every coordinate reachable at a larger size. */
export function BattleshipTargetGrid(props: {
  label: string;
  testId: string;
  cells: readonly CellGridCell[];
  onAim: (cell: string) => void;
  confirmation?: JSX.Element;
  selected: string | null;
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
  const regions = ['A1–E5', 'F1–J5', 'A6–E10', 'F6–J10'];
  const toggleSize = () => {
    const selected = props.selected;
    if (!large() && selected) {
      const right = selected.charAt(0).toLowerCase() >= 'f';
      const bottom = Number(selected.slice(1)) >= 6;
      setArea(Number(right) + Number(bottom) * 2);
    }
    setLarge(!large());
  };
  return (
    <StackVertical gap="xs" width="full">
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
      {props.confirmation}
      <StackHorizontal
        gap="sm"
        align="center"
        justify="between"
        testId={`${props.testId}-target-tools`}
      >
        <Button
          title={large() ? t`Show whole board` : t`Larger targets`}
          intent="neutral"
          variant="outline"
          onClick={toggleSize}
          dataSet={{ testid: `${props.testId}-large-targets` }}
        />
        <Show when={large()}>
          <StackVertical grow>
            <Select
              aria-label={t`Target region: ${regions[area()]}`}
              surfaceTitle={t`Target region`}
              value={area()}
              onValueChange={setArea}
              triggerDataSet={{ testid: `${props.testId}-region` }}
              options={regions.map((label, value) => ({
                label,
                value,
                dataSet: { testid: `${props.testId}-area-${value}` },
              }))}
            />
          </StackVertical>
        </Show>
      </StackHorizontal>
    </StackVertical>
  );
}
