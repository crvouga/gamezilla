import { isShipId, SHIPS } from '@libs/battleship-shared-ts/battleship-board';
import { t } from '@lingui/core/macro';
import { BattleshipPlacementLayout } from '@pkgs/ui-root-client-ts/battleship-placement-layout';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, type JSX, Show } from 'solid-js';
import {
  COLUMN_LABELS,
  orientationName,
  ROW_LABELS,
  shipName,
} from './battleship-copy';
import type { SetupController } from './battleship-setup-controller';

function shipOptions(setup: SetupController, testId: string) {
  return SHIPS.map(({ id, length }) => {
    const placed = setup.draft().get(id);
    return {
      value: id,
      dataSet: { testid: `${testId}-ship-${id}` },
      label:
        placed === undefined
          ? `${shipName(id)} · ${length}`
          : `${shipName(id)} · ${placed.bow.toUpperCase()}, ${orientationName(placed.orientation)}`,
    };
  });
}

function regionOptions(testId: string) {
  return [
    {
      value: 'nw',
      dataSet: { testid: `${testId}-region-nw` },
      label: 'A–E / 1–5',
    },
    {
      value: 'ne',
      dataSet: { testid: `${testId}-region-ne` },
      label: 'F–J / 1–5',
    },
    {
      value: 'sw',
      dataSet: { testid: `${testId}-region-sw` },
      label: 'A–E / 6–10',
    },
    {
      value: 'se',
      dataSet: { testid: `${testId}-region-se` },
      label: 'F–J / 6–10',
    },
  ];
}

/** A magnified bow picker; placement still validates against the full fleet. */
export function SetupPrecision(props: {
  setup: SetupController;
  locked: boolean;
  testId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: JSX.Element;
  commands: JSX.Element;
  feedback: JSX.Element;
}): JSX.Element {
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
    <StackVertical gap="sm" width="full" align="center">
      <Button
        title={props.open ? t`Close enlarged placement` : t`Enlarge placement`}
        variant="outline"
        intent="neutral"
        disabled={props.locked}
        onClick={() => props.onOpenChange(!props.open)}
        dataSet={{ testid: `${props.testId}-enlarge` }}
      />
      <Show
        when={props.open}
        fallback={
          <StackVertical gap="sm" align="center">
            {props.commands}
            {props.feedback}
            {props.overview}
          </StackVertical>
        }
      >
        <BattleshipPlacementLayout
          overviewLabel={t`Fleet overview`}
          overview={props.overview}
          feedback={props.feedback}
          controls={
            <>
              <Select
                label={t`Ship`}
                aria-label={t`Ship to place`}
                placeholder={t`Choose a ship to reposition`}
                value={props.setup.selected() ?? ''}
                onValueChange={(value) => {
                  if (isShipId(value)) props.setup.choose(value);
                }}
                disabled={props.locked}
                triggerDataSet={{ testid: `${props.testId}-ship-picker` }}
                options={shipOptions(props.setup, props.testId)}
              />
              {props.commands}
            </>
          }
          region={
            <Select
              label={t`Region`}
              aria-label={t`Placement area`}
              triggerDataSet={{ testid: `${props.testId}-region-picker` }}
              value={area()}
              onValueChange={setArea}
              disabled={props.locked}
              options={regionOptions(props.testId)}
            />
          }
          working={
            <CellGridBoard
              label={t`Enlarged bow placement`}
              testId={`${props.testId}-precision`}
              columnLabels={COLUMN_LABELS.slice(left(), left() + 5)}
              rowLabels={ROW_LABELS.slice(top(), top() + 5)}
              cells={cells()}
              onActivate={props.setup.place}
              onPreview={props.setup.preview}
              onCellKey={(key) => {
                if (key !== 'r' && key !== 'R') return false;
                props.setup.rotate();
                return true;
              }}
            />
          }
        />
      </Show>
    </StackVertical>
  );
}
