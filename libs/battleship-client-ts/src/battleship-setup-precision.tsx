import { isShipId, SHIPS } from '@libs/battleship-shared-ts/battleship-board';
import { t } from '@lingui/core/macro';
import { BattleshipPlacementLayout } from '@pkgs/ui-root-client-ts/battleship-placement-layout';
import { BattleshipRegionOverview } from '@pkgs/ui-root-client-ts/battleship-target-layout';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
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

function ShipPicker(props: {
  setup: SetupController;
  testId: string;
  locked: boolean;
}): JSX.Element {
  const options = () => shipOptions(props.setup, props.testId);
  const placeholder = () => t`Choose a ship to reposition`;
  const pickerName = () => {
    const visibleLabel =
      options().find((option) => option.value === props.setup.selected())
        ?.label ?? placeholder();
    return `${t`Ship to place`}: ${visibleLabel}`;
  };
  return (
    <Select
      aria-label={pickerName()}
      placeholder={placeholder()}
      value={props.setup.selected() ?? ''}
      onValueChange={(value) => {
        if (isShipId(value)) props.setup.choose(value);
      }}
      disabled={props.locked}
      triggerDataSet={{ testid: `${props.testId}-ship-picker` }}
      options={options()}
    />
  );
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
          overviewLabel={t`Choose region`}
          overview={
            <BattleshipRegionOverview
              overview={props.overview}
              placement
              label={t`Fleet overview`}
              region={['nw', 'ne', 'sw', 'se'].indexOf(area())}
              regions={regionOptions().map((option) => option.label)}
              onRegion={(index) =>
                setArea(['nw', 'ne', 'sw', 'se'][index] ?? 'nw')
              }
              disabled={props.locked}
              testId={props.testId}
            />
          }
          feedback={props.feedback}
          commands={props.commands}
          controls={
            <ShipPicker
              setup={props.setup}
              testId={props.testId}
              locked={props.locked}
            />
          }
          region={
            <P variant="label">{t`Place in ${regionOptions().find((option) => option.value === area())?.label ?? ''}`}</P>
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
      <Button
        title={props.open ? t`Show full board` : t`Enlarge placement`}
        variant="ghost"
        intent="neutral"
        disabled={props.locked}
        onClick={() => props.onOpenChange(!props.open)}
        dataSet={{ testid: `${props.testId}-enlarge` }}
      />
    </StackVertical>
  );
}
