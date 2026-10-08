import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/chess-matchmaking-shared/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameChoiceGrid } from '@pkgs/ui-root-client/game-choice-grid';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { createSignal, type JSX } from 'solid-js';
import { SpeedName } from './speed-name';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

/** Choose one of the offered time controls, then find an opponent at it. */
export function MultiplayerFindPanel(props: {
  readonly controls: MultiplayerControlsModel;
}): JSX.Element {
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  return (
    <GameSection
      title={<Trans>Find your next rival</Trans>}
      description={
        <Trans>Pick your pace. We'll find an opponent for you.</Trans>
      }
    >
      <GameChoiceGrid
        label={<Trans>Time control</Trans>}
        value={timeControl()}
        onChange={setTimeControl}
        choices={TIME_CONTROLS.map((control) => ({
          value: control.id,
          title: control.id,
          detail: <SpeedName speed={control.speed} />,
          dataSet: {
            testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
          },
        }))}
      />
      <p class="text textCaption text-text-secondary">
        <Trans>Minutes per player + seconds added after each move.</Trans>
      </p>
      <GameActionButton
        title={<Trans>Find a chess opponent</Trans>}
        successLabel={<Trans>Opponent search accepted</Trans>}
        operation={() => props.controls.begin(timeControl())}
        variant="solid"
        fullWidth
        dataSet={{ testid: 'multiplayer-find' }}
      />
    </GameSection>
  );
}
