import {
  isShipId,
  SHIPS,
  type ShipId,
} from '@libs/battleship-shared-ts/battleship-board';
import { t } from '@lingui/core/macro';
import type { GameSetupBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import {
  type GameChoice,
  GameChoiceGrid,
} from '@pkgs/ui-root-client-ts/game-choice-grid';
import { createMediaQuery } from '@pkgs/ui-root-client-ts/media-query';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, createUniqueId, type JSX, Show } from 'solid-js';
import {
  COLUMN_LABELS,
  orientationName,
  ROW_LABELS,
  shipName,
} from './battleship-copy';
import type { Draft } from './battleship-draft';
import {
  createSetupController,
  type SetupController,
} from './battleship-setup-controller';
import { SetupPrecision } from './battleship-setup-precision';

function shipChoices(draft: Draft, testId: string): readonly GameChoice[] {
  return SHIPS.map(({ id, length }) => {
    const placed = draft.get(id);
    const bow = placed?.bow.toUpperCase() ?? '';
    const direction =
      placed === undefined ? '' : orientationName(placed.orientation);
    return {
      value: id,
      title: shipName(id),
      detail:
        placed === undefined ? t`${length} cells` : t`${bow}, ${direction}`,
      dataSet: { testid: `${testId}-ship-${id}` },
    };
  });
}
function SetupCommands(props: {
  setup: SetupController;
  locked: boolean;
  testId: string;
}): JSX.Element {
  const selected = (): ShipId | null => props.setup.selected();
  const direction = () =>
    orientationName(props.setup.orientation() === 'h' ? 'v' : 'h');
  const placed = () => {
    const ship = selected();
    return ship !== null && props.setup.draft().has(ship);
  };
  return (
    <StackHorizontal gap="sm" wrap>
      <Button
        title={t`Rotate ${direction()}`}
        intent="neutral"
        variant="outline"
        size="md"
        disabled={props.locked || selected() === null}
        onClick={props.setup.rotate}
        dataSet={{
          testid: `${props.testId}-rotate`,
          orientation: props.setup.orientation(),
        }}
      />
      <Button
        title={t`Remove`}
        intent="neutral"
        variant="ghost"
        size="md"
        disabled={props.locked || !placed()}
        onClick={props.setup.remove}
        dataSet={{ testid: `${props.testId}-remove` }}
      />
    </StackHorizontal>
  );
}

/**
 * Where a side arranges its hidden fleet: choose a ship, turn it, and press
 * the cell for its bow. A placement off the board or over another ship is
 * refused with the reason and leaves the fleet as it was. Its progress is
 * `<testId>-progress`: the screen hosting it keeps `<testId>-status` for
 * its own word on the setup.
 */
export function BattleshipSetupBoard(
  props: GameSetupBoardProps & {
    /** Responsive starts enlarged below 640px; an explicit choice lasts until unmount. */
    initialPlacement?: 'responsive' | 'full' | 'enlarged';
  }
): JSX.Element {
  const setup = createSetupController(props);
  const statusId = createUniqueId();
  const phone = createMediaQuery('(max-width: 639px)');
  const [enlarged, setEnlarged] = createSignal(
    props.initialPlacement === 'enlarged' ||
      ((props.initialPlacement ?? 'responsive') === 'responsive' && phone())
  );
  return (
    <StackVertical gap="md" padding="md" align="center" testId={props.testId}>
      <P
        id={statusId}
        variant="label"
        role="status"
        aria-live="polite"
        testId={`${props.testId}-progress`}
      >
        {setup.status()}
      </P>
      <Show when={props.locked}>
        <Notice dataSet={{ testid: `${props.testId}-locked` }}>
          {t`Your fleet is locked in and can no longer change.`}
        </Notice>
      </Show>
      <Show when={!enlarged() && !props.locked}>
        <GameChoiceGrid
          label={t`Ships`}
          choices={shipChoices(setup.draft(), props.testId)}
          value={setup.selected() ?? ''}
          onChange={(value) => {
            if (isShipId(value)) setup.choose(value);
          }}
          disabled={props.locked}
        />
      </Show>
      <SetupPrecision
        setup={setup}
        locked={props.locked}
        testId={props.testId}
        open={enlarged()}
        onOpenChange={setEnlarged}
        commands={
          <Show when={!props.locked}>
            <SetupCommands
              setup={setup}
              locked={props.locked}
              testId={props.testId}
            />
          </Show>
        }
        feedback={
          <Show when={!props.locked}>
            <Show
              when={setup.refusal()}
              fallback={
                <P variant="caption" testId={`${props.testId}-guidance`}>
                  {setup.instruction()}
                </P>
              }
            >
              {(reason) => (
                <P
                  variant="caption"
                  tone="destructive"
                  role="alert"
                  testId={`${props.testId}-refusal`}
                >
                  {reason()}{' '}
                  {t`Choose another bow cell or rotate, then try again.`}
                </P>
              )}
            </Show>
          </Show>
        }
        overview={
          <CellGridBoard
            label={t`Your waters`}
            testId={`${props.testId}-grid`}
            cellTestId={(cell) => `${props.testId}-cell-${cell}`}
            columnLabels={COLUMN_LABELS}
            rowLabels={ROW_LABELS}
            cells={setup.cells()}
            describedBy={statusId}
            onActivate={(cell) => {
              if (!enlarged()) setup.place(cell);
            }}
            onPreview={setup.preview}
            onCellKey={(key) => {
              if (key !== 'r' && key !== 'R') return false;
              setup.rotate();
              return true;
            }}
          />
        }
      />
    </StackVertical>
  );
}
