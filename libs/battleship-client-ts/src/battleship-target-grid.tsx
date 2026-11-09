import { t } from '@lingui/core/macro';
import {
  BattleshipRegionOverview,
  BattleshipTargetHeader,
  BattleshipTargetLayout,
  BattleshipWholeBoard,
} from '@pkgs/ui-root-client-ts/battleship-target-layout';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
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

/** The ten regions, two rows of five columns each, named by their corners. */
const REGIONS = Array.from(
  { length: 10 },
  (_, n) =>
    `${n % 2 === 0 ? 'A' : 'F'}${Math.floor(n / 2) * 2 + 1}–${n % 2 === 0 ? 'E' : 'J'}${Math.floor(n / 2) * 2 + 2}`
);

/** The open region's columns, rows and cells, read from the board once per change. */
function createRegionCells(
  all: () => readonly CellGridCell[],
  area: () => number
) {
  const columns = createMemo(() =>
    COLUMN_LABELS.slice((area() % 2) * 5, (area() % 2) * 5 + 5)
  );
  const rows = createMemo(() =>
    ROW_LABELS.slice(Math.floor(area() / 2) * 2, Math.floor(area() / 2) * 2 + 2)
  );
  const cells = createMemo(() =>
    all().filter(
      (cell) =>
        columns().includes(cell.id[0]?.toUpperCase() ?? '') &&
        rows().includes(cell.id.slice(1))
    )
  );
  return { columns, rows, cells };
}

/**
 * The rival's waters as one board: aimed at directly where cells are large
 * (a wide screen), and looked at the same way by anyone who only inspects.
 */
function WholeWaters(props: {
  label: string;
  testId: string;
  cells: readonly CellGridCell[];
  aim: boolean;
  onAim: (cell: string) => void;
  legend?: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical gap="xs" width="full">
      <BattleshipTargetHeader>
        <P variant="caption">
          {props.aim ? t`Choose a cell` : t`Shots so far`}
        </P>
        {props.legend}
      </BattleshipTargetHeader>
      <BattleshipWholeBoard>
        <CellGridBoard
          fill
          label={props.label}
          testId={`${props.testId}-target-grid`}
          cellTestId={(cell) => `${props.testId}-target-${cell}`}
          columnLabels={COLUMN_LABELS}
          rowLabels={ROW_LABELS}
          cells={props.cells}
          onActivate={props.aim ? props.onAim : undefined}
        />
      </BattleshipWholeBoard>
    </StackVertical>
  );
}

/**
 * The rival's waters. A wide screen aims at the whole board directly; a
 * phone or tablet keeps the whole field in view while ten coarse regions
 * offer precise two-row aiming. Inspecting, at any size, is the whole board.
 */
export function BattleshipTargetGrid(props: {
  label: string;
  testId: string;
  cells: readonly CellGridCell[];
  onAim: (cell: string) => void;
  /**
   * The viewer only looks: a watcher, or a player whose turn it is not.
   * A shot being sent is still the viewer's aim, not an inspection.
   * Omitted, it follows the cells: inspecting when none can be aimed at.
   */
  inspect?: boolean;
  /** The key to the marks, shown beside the region instruction. */
  legend?: JSX.Element;
  /** Fire and its instruction, under the cells; given the open region. */
  confirmation?: (region: () => string) => JSX.Element;
}): JSX.Element {
  const [area, setArea] = createSignal(0);
  const descriptions = createMemo(() => regionDescriptions(props.cells));
  const canAim = createMemo(() =>
    props.inspect === undefined
      ? props.cells.some((cell) => cell.enabled)
      : !props.inspect
  );
  const { columns, rows, cells } = createRegionCells(() => props.cells, area);
  const mode = useLayoutMode();
  const workbench = () => mode() !== 'wide' && canAim();
  const regions = REGIONS;
  return (
    <StackVertical gap="xs" width="full">
      <Show
        when={workbench()}
        fallback={
          <WholeWaters
            label={props.label}
            testId={props.testId}
            cells={props.cells}
            aim={canAim()}
            onAim={props.onAim}
            legend={props.legend}
          />
        }
      >
        <BattleshipTargetLayout
          header={
            <>
              <P variant="caption">{t`Choose a region`}</P>
              {props.legend}
            </>
          }
          overview={
            <BattleshipRegionOverview
              region={area()}
              regions={regions}
              descriptions={descriptions()}
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
            // Fire under the cells carries the cell instruction.
            <StackVertical gap="xs" testId={`${props.testId}-target-tools`} />
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
      </Show>
      {props.confirmation?.(() => (workbench() ? (regions[area()] ?? '') : ''))}
    </StackVertical>
  );
}
