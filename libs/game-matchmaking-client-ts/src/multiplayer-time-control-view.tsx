import {
  MULTIPLAYER_SPEEDS,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import { SpeedName } from './speed-name';
import { timeControlChoiceText, timeControlWords } from './time-control-name';

/**
 * The clock a search is for: every offered time control, grouped by its
 * speed, the chosen one marked. Pressing one chooses it and returns to
 * finding an opponent; Back keeps the choice as it was.
 */
export function MultiplayerTimeControlView(
  props: MultiplayerPlaceFrame & {
    /** The time control chosen now. */
    readonly timeControl: string;
    /** Chooses a time control and returns to finding an opponent. */
    readonly onChoose: (timeControl: string) => void;
  }
): JSX.Element {
  return (
    <MultiplayerMenuPlace
      {...props}
      title={<Trans>Time control</Trans>}
      subtitle={
        <Trans>
          Each player's time for the whole game, plus seconds added every move.
          Chosen now: {timeControlWords(props.timeControl)}.
        </Trans>
      }
    >
      <For each={MULTIPLAYER_SPEEDS}>
        {(speed) => (
          <MenuSection title={<SpeedName speed={speed} />}>
            <Grid columns={3} gap="sm">
              <For each={TIME_CONTROLS.filter((c) => c.speed === speed)}>
                {(control) => (
                  <Button
                    title={timeControlChoiceText(control.id)}
                    aria-label={timeControlWords(control.id)}
                    aria-pressed={props.timeControl === control.id}
                    variant={
                      props.timeControl === control.id ? 'solid' : 'outline'
                    }
                    intent={
                      props.timeControl === control.id ? 'primary' : 'neutral'
                    }
                    onClick={() => props.onChoose(control.id)}
                    dataSet={{
                      testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
                    }}
                  />
                )}
              </For>
            </Grid>
          </MenuSection>
        )}
      </For>
    </MultiplayerMenuPlace>
  );
}
