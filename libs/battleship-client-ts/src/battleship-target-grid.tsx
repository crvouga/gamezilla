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
import { createMemo, createSignal, type JSX } from 'solid-js';
import { COLUMN_LABELS, ROW_LABELS } from './battleship-copy';

function regionDescriptions(cells: readonly CellGridCell[]): readonly string[] {
  const groups = Array.from({ length: 10 }, (): string[] => []);
  for (const cell of cells) {
    if (cell.tone === 'open' && cell.emphasis !== 'pending') continue;
    const column = cell.id.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = Number(cell.id.slice(1)) - 1;
    const region = Math.floor(row / 2) * 2 + Math.floor(column / 5);
    groups[region]?.push(cell.label);
  }
  return groups.map((labels) =>
    labels.length === 0 ? t`No shots in this region` : labels.join('; ')
  );
}

/** The full field stays visible while ten coarse regions offer precise two-row aiming. */
export function BattleshipTargetGrid(props: {
  label: string;
  testId: string;
  cells: readonly CellGridCell[];
  onAim: (cell: string) => void;
  confirmation?: JSX.Element;
}): JSX.Element {
  const [area, setArea] = createSignal(0);
  const descriptions = createMemo(() => regionDescriptions(props.cells));
  const canAim = createMemo(() => props.cells.some((cell) => cell.enabled));
  const columns = createMemo(() =>
    COLUMN_LABELS.slice((area() % 2) * 5, (area() % 2) * 5 + 5)
  );
  const rows = createMemo(() =>
    ROW_LABELS.slice(Math.floor(area() / 2) * 2, Math.floor(area() / 2) * 2 + 2)
  );
  const cells = createMemo(() =>
    props.cells.filter(
      (cell) =>
        columns().includes(cell.id[0]?.toUpperCase() ?? '') &&
        rows().includes(cell.id.slice(1))
    )
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
            heading={t`Choose a region`}
            region={area()}
            regions={regions}
            descriptions={descriptions()}
            onRegion={setArea}
            testId={props.testId}
            label={
              canAim()
                ? t`Choose a target region`
                : t`Choose a region to inspect`
            }
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
            <P variant="label">
              {canAim()
                ? t`Choose a cell: ${regions[area()]}`
                : t`Inspect cells: ${regions[area()]}`}
            </P>
          </StackVertical>
        }
        working={
          <StackVertical gap="xs" align="center" width="full">
            <CellGridBoard
              label={canAim() ? t`Precise aim` : t`Shot details`}
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
