import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/chess-matchmaking-shared/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameChoiceGrid } from '@pkgs/ui-root-client/game-choice-grid';
import { GameSetupPanel } from '@pkgs/ui-root-client/game-setup-panel';
import { createSignal, type JSX } from 'solid-js';
import { SpeedName } from './speed-name';
import { timeControlChoiceText } from './time-control-name';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

/** Choose one of the offered time controls, then find an opponent at it. */
export function MultiplayerFindPanel(props: {
  readonly controls: MultiplayerControlsModel;
}): JSX.Element {
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  return (
    <GameSetupPanel
      title={<Trans>New game</Trans>}
      description={
        <Trans>
          Minutes per player + seconds added after each move, or days for every
          move in a daily game.
        </Trans>
      }
      actions={
        <GameActionButton
          title={<Trans>Find a chess opponent</Trans>}
          successLabel={<Trans>Opponent search accepted</Trans>}
          operation={() => props.controls.begin(timeControl())}
          variant="solid"
          fullWidth
          dataSet={{ testid: 'multiplayer-find' }}
        />
      }
    >
      <GameChoiceGrid
        label={<Trans>Time control</Trans>}
        value={timeControl()}
        onChange={setTimeControl}
        choices={TIME_CONTROLS.map((control) => ({
          value: control.id,
          title: timeControlChoiceText(control.id),
          detail: <SpeedName speed={control.speed} />,
          dataSet: {
            testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
          },
        }))}
      />
    </GameSetupPanel>
  );
}
