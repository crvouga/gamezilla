import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/chess-matchmaking-shared/time-control';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { Chip } from '@pkgs/ui-root-client/chip';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal, For, type JSX } from 'solid-js';
import { SpeedName } from './speed-name';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

/** Choose one of the offered time controls, then find an opponent at it. */
export function MultiplayerFindPanel(props: {
  readonly controls: MultiplayerControlsModel;
}): JSX.Element {
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  const begin = useMutationButton({
    operation: () => props.controls.begin(timeControl()),
    labels: {
      idle: <Trans>Find a chess opponent</Trans>,
      loading: <Trans>Finding an opponent…</Trans>,
      success: <Trans>Opponent search accepted</Trans>,
      error: <Trans>Try finding an opponent again</Trans>,
    },
  });
  return (
    <div class="box gap-3" data-component="MultiplayerFindPanel">
      <p class="text textLabel" id="multiplayer-time-control-label">
        <Trans>Time control</Trans>
      </p>
      <div
        class="box flex-row flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby="multiplayer-time-control-label"
      >
        <For each={TIME_CONTROLS}>
          {(control) => (
            <Chip
              role="radio"
              label={
                <>
                  {control.id} <SpeedName speed={control.speed} />
                </>
              }
              selected={control.id === timeControl()}
              onClick={() => setTimeControl(control.id)}
              dataSet={{
                testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
              }}
            />
          )}
        </For>
      </div>
      <Button {...begin.buttonProps} dataSet={{ testid: 'multiplayer-find' }} />
    </div>
  );
}
