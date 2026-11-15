import {
  isDailyTimeControl,
  MULTIPLAYER_SPEEDS,
  TIME_CONTROLS,
  timeControlKey,
  timeControlOf,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { For, type JSX, Show } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';
import { SpeedName } from './speed-name';
import { timeControlChoiceText, timeControlWords } from './time-control-name';

/** The speed a time control belongs to (`blitz`). */
function speedOf(id: string): string {
  return timeControlOf(plainClock(id))?.speed ?? '';
}

/** A time control without the game's prefix (`chess/5+0` is `5+0`). */
function plainClock(id: string): string {
  return id.split('/').at(-1) ?? id;
}

/**
 * Every offered clock, as tiles grouped by speed, the chosen one checked.
 * Pressing a tile chooses it and returns to finding an opponent; arrow keys
 * move the choice and stay. Back keeps the choice as it was.
 */
export function MultiplayerTimeControlView(
  props: MultiplayerPlaceFrame & {
    /** The time control chosen now. */
    readonly timeControl: string;
    /** Chooses a time control, staying here. */
    readonly onChange: (timeControl: string) => void;
    /** Chooses a time control and returns to finding an opponent. */
    readonly onChoose: (timeControl: string) => void;
  }
): JSX.Element {
  return (
    <MultiplayerMenuPlace
      {...props}
      title={<Trans>Time control</Trans>}
      subtitle={
        <Show
          when={isDailyTimeControl(props.timeControl)}
          fallback={
            <Trans>
              Chosen: {timeControlChoiceText(props.timeControl)},{' '}
              <SpeedName speed={speedOf(props.timeControl)} />. Minutes each,
              plus seconds per move.
            </Trans>
          }
        >
          <Trans>Chosen: {timeControlWords(props.timeControl)}.</Trans>
        </Show>
      }
    >
      <For each={MULTIPLAYER_SPEEDS}>
        {(speed) => (
          <GameChoiceGrid
            label={<SpeedName speed={speed} />}
            columns={4}
            choices={TIME_CONTROLS.filter((c) => c.speed === speed).map(
              (control) => ({
                value: control.id,
                title: timeControlChoiceText(control.id),
                dataSet: {
                  testid: `multiplayer-time-control-${timeControlKey(control.id)}`,
                },
              })
            )}
            value={plainClock(props.timeControl)}
            onChange={(id) => props.onChange(id)}
            onPress={(id) => props.onChoose(id)}
          />
        )}
      </For>
    </MultiplayerMenuPlace>
  );
}
