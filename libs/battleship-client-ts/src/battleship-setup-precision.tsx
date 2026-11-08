import { isShipId, SHIPS } from '@libs/battleship-shared-ts/battleship-board';
import { t } from '@lingui/core/macro';
import { BattleshipPlacementLayout } from '@pkgs/ui-root-client-ts/battleship-placement-layout';
import { BattleshipRegionOverview } from '@pkgs/ui-root-client-ts/battleship-target-layout';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
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

function SetupShipPicker(props: {
  setup: SetupController;
  locked: boolean;
  testId: string;
}): JSX.Element {
  const options = () => shipOptions(props.setup, props.testId);
  const placeholder = () => t`Choose a ship to reposition`;
  // The accessible name starts with the visible label it shows.
  const pickerName = () => {
    const visibleLabel =
      options().find((option) => option.value === props.setup.selected())
        ?.label ?? placeholder();
    return `${t`Ship to place`}: ${visibleLabel}`;
  };
  return (
    <Show when={!props.locked}>
      <Select
        aria-label={pickerName()}
        placeholder={placeholder()}
        value={props.setup.selected() ?? ''}
        onValueChange={(value) => {
          if (isShipId(value)) props.setup.choose(value);
        }}
        triggerDataSet={{ testid: `${props.testId}-ship-picker` }}
        options={options()}
      />
    </Show>
  );
}

function regionOptions() {
  return [
    {
      value: 'nw',
      label: 'A–E / 1–5',
    },
    {
      value: 'ne',
      label: 'F–J / 1–5',
    },
    {
      value: 'sw',
      label: 'A–E / 6–10',
    },
    {
      value: 'se',
      label: 'F–J / 6–10',
    },
  ];
}

function createRegion(setup: () => SetupController) {
  const [area, setArea] = createSignal('nw');
  const left = () => (area().endsWith('w') ? 0 : 5);
  const top = () => (area().startsWith('n') ? 0 : 5);
  const cells = createMemo(() =>
    setup()
      .cells()
      .filter(
        (_, index) =>
          index % 10 >= left() &&
          index % 10 < left() + 5 &&
          Math.floor(index / 10) >= top() &&
          Math.floor(index / 10) < top() + 5
      )
  );
  return { area, setArea, left, top, cells };
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
  const region = createRegion(() => props.setup);
  return (
    <StackVertical gap="sm" width="full" align="center">
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
          inspection={props.locked}
          overviewLabel={
            props.locked ? t`Inspect your fleet` : t`Choose region`
          }
          overview={
            <BattleshipRegionOverview
              overview={props.overview}
              placement
              label={t`Fleet overview`}
              region={['nw', 'ne', 'sw', 'se'].indexOf(region.area())}
              regions={regionOptions().map((option) => option.label)}
              onRegion={(index) =>
                region.setArea(['nw', 'ne', 'sw', 'se'][index] ?? 'nw')
              }
              testId={props.testId}
            />
          }
          feedback={props.feedback}
          commands={props.commands}
          controls={
            <SetupShipPicker
              setup={props.setup}
              locked={props.locked}
              testId={props.testId}
            />
          }
          region={
            <P variant="label">
              {props.locked
                ? t`Inspect ${regionOptions().find((option) => option.value === region.area())?.label ?? ''}`
                : t`Place in ${regionOptions().find((option) => option.value === region.area())?.label ?? ''}`}
            </P>
          }
          working={
            <CellGridBoard
              label={
                props.locked
                  ? t`Enlarged fleet inspection`
                  : t`Enlarged bow placement`
              }
              testId={`${props.testId}-precision`}
              columnLabels={COLUMN_LABELS.slice(
                region.left(),
                region.left() + 5
              )}
              rowLabels={ROW_LABELS.slice(region.top(), region.top() + 5)}
              cells={region.cells()}
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
      <Button
        title={
          props.open
            ? t`Show full board`
            : props.locked
              ? t`Enlarge fleet`
              : t`Enlarge placement`
        }
        variant="ghost"
        intent="neutral"
        onClick={() => props.onOpenChange(!props.open)}
        dataSet={{ testid: `${props.testId}-enlarge` }}
      />
    </StackVertical>
  );
}
