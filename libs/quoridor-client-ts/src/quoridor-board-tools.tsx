import { t } from '@lingui/core/macro';
import type { GameFrameAction } from '@pkgs/turn-game-shared-ts/game-frame';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { CellGridCell } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';
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
      <For each={props.actions}>
        {(action) => (
          <Button
            title={
              action.id === 'mode-h'
                ? t`Wall across`
                : action.id === 'mode-v'
                  ? t`Wall down`
                  : action.label
            }
            aria-label={action.label}
            disabled={!action.enabled}
            aria-pressed={action.pressed}
            variant={
              action.pressed || action.emphasis === 'primary'
                ? 'solid'
                : 'outline'
            }
            dataSet={{ testid: `${props.testId}-${action.id}` }}
            onClick={action.run}
          />
        )}
      </For>
    </StackHorizontal>
  );
}

/** Full-size coordinate choices supplement the whole board's smaller touch cells. */
export function QuoridorTargetPicker(props: {
  testId: string;
  tool: QuoridorTool;
  cells: readonly CellGridCell[];
  selected: string | null;
  onActivate: (cell: string) => void;
}): JSX.Element {
  return (
    <Select
      label={
        props.tool === 'move'
          ? t`Move to a coordinate`
          : t`Preview a wall at a coordinate`
      }
      value={props.selected ?? ''}
      searchable={props.tool !== 'move'}
      triggerDataSet={{ testid: `${props.testId}-precise-target` }}
      options={props.cells
        .filter((cell) => cell.enabled)
        .map((cell) => ({
          value: cell.id,
          label:
            props.tool === 'move'
              ? cell.label
              : `${cell.id}: ${quoridorBoundary(`${cell.id}${props.tool}`)}`,
          dataSet: { testid: `${props.testId}-precise-${cell.id}` },
        }))}
      onValueChange={props.onActivate}
    />
  );
}
