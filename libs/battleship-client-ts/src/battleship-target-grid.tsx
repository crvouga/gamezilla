import { t } from '@lingui/core/macro';
import {
  BattleshipRegionOverview,
  BattleshipTargetLayout,
} from '@pkgs/ui-root-client-ts/battleship-target-layout';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { COLUMN_LABELS, ROW_LABELS } from './battleship-copy';

/** The full field stays visible while ten coarse regions offer precise two-row aiming. */
export function BattleshipTargetGrid(props: {
  label: string;
  testId: string;
  cells: readonly CellGridCell[];
  onAim: (cell: string) => void;
  confirmation?: JSX.Element;
}): JSX.Element {
  const [area, setArea] = createSignal(0);
  const columns = () =>
    COLUMN_LABELS.slice((area() % 2) * 5, (area() % 2) * 5 + 5);
  const rows = () =>
    ROW_LABELS.slice(
      Math.floor(area() / 2) * 2,
      Math.floor(area() / 2) * 2 + 2
    );
  const cells = () =>
    props.cells.filter(
      (cell) =>
        columns().includes(cell.id[0]?.toUpperCase() ?? '') &&
        rows().includes(cell.id.slice(1))
    );
  const regions = Array.from(
    { length: 10 },
    (_, n) =>
      `${n % 2 === 0 ? 'A' : 'F'}${Math.floor(n / 2) * 2 + 1}–${n % 2 === 0 ? 'E' : 'J'}${Math.floor(n / 2) * 2 + 2}`
  );
  return (
    <StackVertical gap="xs" width="full">
      <BattleshipTargetLayout
        overview={
          <BattleshipRegionOverview
            region={area()}
            regions={regions}
            onRegion={setArea}
            testId={props.testId}
            label={t`Choose a target region`}
            overview={
              <CellGridBoard
                fill
                label={props.label}
                testId={`${props.testId}-target-grid`}
                cellTestId={(cell) => `${props.testId}-target-${cell}`}
                columnLabels={COLUMN_LABELS}
                rowLabels={ROW_LABELS}
                cells={props.cells}
              />
            }
          />
        }
        controls={
          <StackVertical gap="xs" testId={`${props.testId}-target-tools`}>
            <P variant="caption">{t`Choose a region`}</P>
            <P variant="label">{t`Aim in ${regions[area()]}`}</P>
          </StackVertical>
        }
        working={
          <StackVertical gap="xs" align="center" width="full">
            <CellGridBoard
              label={t`Precise aim`}
              testId={`${props.testId}-aim-grid`}
              cellTestId={(cell) => `${props.testId}-aim-${cell}`}
              columnLabels={columns()}
              rowLabels={rows()}
              cells={cells()}
              onActivate={props.onAim}
            />
          </StackVertical>
        }
      />
      {props.confirmation}
    </StackVertical>
  );
}
