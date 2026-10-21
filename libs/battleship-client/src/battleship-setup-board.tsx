import {
  isShipId,
  SHIPS,
  type ShipId,
} from '@libs/battleship-shared/battleship-board';
import { t } from '@lingui/core/macro';
import type { GameSetupBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import { Button } from '@pkgs/ui-root-client/button';
import { CellGridBoard } from '@pkgs/ui-root-client/cell-grid-board';
import {
  type GameChoice,
  GameChoiceGrid,
} from '@pkgs/ui-root-client/game-choice-grid';
import { Notice } from '@pkgs/ui-root-client/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { createUniqueId, type JSX, Show } from 'solid-js';
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
        placed === undefined
          ? t`${length} cells, to place`
          : t`${length} cells, placed at ${bow} ${direction}`,
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
  const direction = () => orientationName(props.setup.orientation());
  const placed = () => {
    const ship = selected();
    return ship !== null && props.setup.draft().has(ship);
  };
  return (
    <StackHorizontal gap="sm" wrap>
      <Button
        title={t`Rotate: ${direction()}`}
        intent="neutral"
        variant="outline"
        size="sm"
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
        size="sm"
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
 * refused with the reason and leaves the fleet as it was.
 */
export function BattleshipSetupBoard(props: GameSetupBoardProps): JSX.Element {
  const setup = createSetupController(props);
  const statusId = createUniqueId();
  return (
    <StackVertical gap="md" align="center" testId={props.testId}>
      <P
        id={statusId}
        variant="caption"
        role="status"
        aria-live="polite"
        testId={`${props.testId}-status`}
      >
        {setup.status()}
      </P>
      <Show when={props.locked}>
        <Notice dataSet={{ testid: `${props.testId}-locked` }}>
          {t`Your fleet is locked in and can no longer change.`}
        </Notice>
      </Show>
      <GameChoiceGrid
        label={t`Ships`}
        choices={shipChoices(setup.draft(), props.testId)}
        value={setup.selected() ?? ''}
        onChange={(value) => {
          if (isShipId(value)) setup.choose(value);
        }}
        disabled={props.locked}
      />
      <SetupCommands
        setup={setup}
        locked={props.locked}
        testId={props.testId}
      />
      <Show when={setup.refusal()}>
        {(reason) => (
          <Notice tone="error" dataSet={{ testid: `${props.testId}-refusal` }}>
            {reason()}
          </Notice>
        )}
      </Show>
      <CellGridBoard
        label={t`Your waters`}
        testId={`${props.testId}-grid`}
        cellTestId={(cell) => `${props.testId}-cell-${cell}`}
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={setup.cells()}
        describedBy={statusId}
        onActivate={setup.place}
        onPreview={setup.preview}
        onCellKey={(key) => {
          if (key !== 'r' && key !== 'R') return false;
          setup.rotate();
          return true;
        }}
      />
    </StackVertical>
  );
}
