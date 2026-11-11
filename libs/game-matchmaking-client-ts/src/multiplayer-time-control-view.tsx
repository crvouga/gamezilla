import {
  MULTIPLAYER_SPEEDS,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { CheckIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX, Show } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import { SpeedName } from './speed-name';
import { timeControlWords } from './time-control-name';

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
        </Trans>
      }
    >
      <For each={MULTIPLAYER_SPEEDS}>
        {(speed) => (
          <MenuSection title={<SpeedName speed={speed} />}>
            <For each={TIME_CONTROLS.filter((c) => c.speed === speed)}>
              {(control) => (
                <MenuRow
                  title={timeControlWords(control.id)}
                  trailing={
                    <Show when={props.timeControl === control.id}>
                      <CheckIcon size={20} color="tint" />
                    </Show>
                  }
                  selected={props.timeControl === control.id}
                  hideChevron
                  onClick={() => props.onChoose(control.id)}
                  dataSet={{
                    testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
                  }}
                />
              )}
            </For>
          </MenuSection>
        )}
      </For>
    </MultiplayerMenuPlace>
  );
}
