import { isShipId, SHIPS } from '@libs/battleship-shared-ts/battleship-board';
import { t } from '@lingui/core/macro';
import { BattleshipPlacementLayout } from '@pkgs/ui-root-client-ts/battleship-placement-layout';
import { BattleshipRegionOverview } from '@pkgs/ui-root-client-ts/battleship-target-layout';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { Stack, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, Show } from 'solid-js';
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

function regionLabel(area: string): string {
  return regionOptions().find((option) => option.value === area)?.label ?? '';
}

type PrecisionProps = {
  setup: SetupController;
  locked: boolean;
  testId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: JSX.Element;
  /** The fleet's progress line; beside the board when it is not enlarged. */
  progress: JSX.Element;
  /** The ship choices, shown only beside the full board. */
  choices: JSX.Element;
  commands: JSX.Element;
  feedback: JSX.Element;
};

function EnlargeToggle(props: PrecisionProps): JSX.Element {
  return (
    <Button
      title={props.open ? t`Show full board` : t`Enlarge board`}
      variant="outline"
      intent="neutral"
      onClick={() => props.onOpenChange(!props.open)}
      dataSet={{ testid: `${props.testId}-enlarge` }}
    />
  );
}

/**
 * The full board: from a wide screen the fleet's choices sit beside the
 * board, so every row and the way to enlarge stay above the fold.
 */
function FullBoard(props: PrecisionProps): JSX.Element {
  return (
    <Stack
      direction={{ base: 'vertical', lg: 'horizontal' }}
      gap="lg"
      justify="center"
      width="full"
    >
      <Show when={!props.locked}>
        {/* Centred above the board when stacked, top-aligned beside it. */}
        <StackVertical align="center">
          <StackVertical gap="sm" align="start" maxWidth="form">
            {props.progress}
            {props.choices}
            {props.commands}
            {props.feedback}
          </StackVertical>
        </StackVertical>
      </Show>
      <StackVertical gap="sm" align="center" width="full" shrink>
        {props.overview}
        <EnlargeToggle {...props} />
      </StackVertical>
    </Stack>
  );
}

type Region = ReturnType<typeof createRegion>;

/** A magnified bow picker; placement still validates against the full fleet. */
function EnlargedBoard(
  props: PrecisionProps & { region: Region }
): JSX.Element {
  return (
    <StackVertical gap="sm" width="full" align="center">
      {props.progress}
      <BattleshipPlacementLayout
        inspection={props.locked}
        overviewLabel={props.locked ? t`Inspect your fleet` : t`Choose region`}
        overview={
          <BattleshipRegionOverview
            overview={props.overview}
            placement
            label={t`Fleet overview`}
            region={['nw', 'ne', 'sw', 'se'].indexOf(props.region.area())}
            regions={regionOptions().map((option) => option.label)}
            onRegion={(index) =>
              props.region.setArea(['nw', 'ne', 'sw', 'se'][index] ?? 'nw')
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
          <P variant="label" testId={`${props.testId}-region-heading`}>
            {props.locked
              ? t`Inspect ${regionLabel(props.region.area())}`
              : t`Place in ${regionLabel(props.region.area())}`}
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
              props.region.left(),
              props.region.left() + 5
            )}
            rowLabels={ROW_LABELS.slice(
              props.region.top(),
              props.region.top() + 5
            )}
            cells={props.region.cells()}
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
      <EnlargeToggle {...props} />
    </StackVertical>
  );
}

/** The full board, or its magnified bow picker once enlarged. */
export function SetupPrecision(props: PrecisionProps): JSX.Element {
  // The region chosen lasts while the board is shown full and enlarged again.
  const region = createRegion(() => props.setup);
  return (
    <Show when={props.open} fallback={<FullBoard {...props} />}>
      <EnlargedBoard {...props} region={region} />
    </Show>
  );
}
