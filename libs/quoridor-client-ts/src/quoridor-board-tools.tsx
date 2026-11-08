import { t } from '@lingui/core/macro';
import type { GameFrameAction } from '@pkgs/turn-game-shared-ts/game-frame';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { CellGridCell } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Index, type JSX } from 'solid-js';
import { type QuoridorTool, quoridorBoundary } from './quoridor-board-cells';

/** The same tools in every host, directly beside the working board. */
export function QuoridorBoardTools(props: {
  testId: string;
  actions: readonly GameFrameAction[];
}): JSX.Element {
  return (
    <StackHorizontal
      gap="xs"
      wrap
      dataSet={{ testid: `${props.testId}-tools` }}
    >
      <Index each={props.actions}>
        {(action) => (
          <Button
            title={action().id === 'mode-move' ? t`Move` : action().label}
            aria-label={action().label}
            disabled={!action().enabled}
            aria-pressed={action().pressed}
            variant={
              action().pressed || action().emphasis === 'primary'
                ? 'solid'
                : 'ghost'
            }
            dataSet={{ testid: `${props.testId}-${action().id}` }}
            onClick={action().run}
          />
        )}
      </Index>
    </StackHorizontal>
  );
}

/** Full-size coordinate choices supplement the whole board's smaller touch cells. */
/** Picker rows: full descriptions, filtered by coordinate alone. */
export function quoridorTargetOptions(
  testId: string,
  tool: QuoridorTool,
  cells: readonly CellGridCell[]
) {
  return cells
    .filter((cell) => cell.enabled)
    .map((cell) => ({
      value: cell.id,
      label:
        tool === 'move' ? cell.label : quoridorBoundary(`${cell.id}${tool}`),
      // Every wall label shares words like "above", so a letter would match them all.
      searchText: cell.id,
      dataSet: { testid: `${testId}-precise-${cell.id}` },
    }));
}

export function QuoridorTargetPicker(props: {
  testId: string;
  tool: QuoridorTool;
  cells: readonly CellGridCell[];
  selected: string | null;
  onActivate: (cell: string) => void;
}): JSX.Element {
  return (
    <Select
      aria-label={
        props.tool === 'move'
          ? t`Move to a coordinate`
          : props.tool === 'h'
            ? t`Wall starts above a square`
            : t`Wall starts to the right of a square`
      }
      placeholder={
        props.tool === 'move' ? t`Choose destination` : t`Choose wall anchor`
      }
      surfaceTitle={
        props.tool === 'move' ? t`Choose destination` : t`Choose wall anchor`
      }
      value={props.selected ?? ''}
      searchable={props.tool !== 'move'}
      triggerDataSet={{ testid: `${props.testId}-precise-target` }}
      options={quoridorTargetOptions(props.testId, props.tool, props.cells)}
      onValueChange={props.onActivate}
    />
  );
}
