import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX, Show } from 'solid-js';
import { COLUMN_LABELS, ROW_LABELS } from './battleship-copy';
import type { SetupController } from './battleship-setup-controller';

/** A magnified bow picker; placement still validates against the full fleet. */
export function SetupPrecision(props: {
  setup: SetupController;
  locked: boolean;
  testId: string;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [area, setArea] = createSignal('nw');
  const left = () => (area().endsWith('w') ? 0 : 5);
  const top = () => (area().startsWith('n') ? 0 : 5);
  const cells = () =>
    props.setup
      .cells()
      .filter(
        (_, index) =>
          index % 10 >= left() &&
          index % 10 < left() + 5 &&
          Math.floor(index / 10) >= top() &&
          Math.floor(index / 10) < top() + 5
      );
  return (
    <StackVertical gap="sm" width="full">
      <Button
        title={open() ? t`Close enlarged placement` : t`Enlarge placement`}
        variant="outline"
        intent="neutral"
        disabled={props.locked}
        onClick={() => setOpen(!open())}
        dataSet={{ testid: `${props.testId}-enlarge` }}
      />
      <Show when={open()}>
        <P variant="caption">{t`Choose an area, then tap a large cell for the ship’s bow. Ships can extend into another area; the full fleet is shown below.`}</P>
        <GameChoiceGrid
          label={t`Placement area`}
          value={area()}
          onChange={setArea}
          disabled={props.locked}
          choices={[
            { value: 'nw', title: 'A–E / 1–5' },
            { value: 'ne', title: 'F–J / 1–5' },
            { value: 'sw', title: 'A–E / 6–10' },
            { value: 'se', title: 'F–J / 6–10' },
          ]}
        />
        <CellGridBoard
          fill
          label={t`Enlarged bow placement`}
          testId={`${props.testId}-precision`}
          columnLabels={COLUMN_LABELS.slice(left(), left() + 5)}
          rowLabels={ROW_LABELS.slice(top(), top() + 5)}
          cells={cells()}
          onActivate={props.setup.place}
          onPreview={props.setup.preview}
        />
      </Show>
    </StackVertical>
  );
}
