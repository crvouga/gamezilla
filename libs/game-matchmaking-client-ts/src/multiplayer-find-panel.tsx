import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { createSignal, type JSX, Show } from 'solid-js';
import { SpeedName } from './speed-name';
import { timeControlChoiceText } from './time-control-name';

/**
 * Choose one of the offered time controls (for a game with clock choices),
 * then find an opponent, or the other players of a bigger game, at it.
 */
export function MultiplayerFindPanel(props: {
  /** How many players a game seats, the person included. */
  readonly players: number;
  /** The game offers clock choices. */
  readonly timed: boolean;
  /** Starts the search, at the chosen time control when timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
}): JSX.Element {
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  const count = () => props.players;
  return (
    <GameSetupPanel
      title={<Trans>New game</Trans>}
      description={
        <>
          <Show when={count() > 2}>
            <Show
              when={props.timed}
              fallback={
                <Trans>
                  A game needs {count()} players including you. Find{' '}
                  {count() - 1} other players.
                </Trans>
              }
            >
              <Trans>
                A game needs {count()} players including you. Find {count() - 1}{' '}
                other players at the same clock choice.
              </Trans>
            </Show>{' '}
          </Show>
          <Show
            when={props.timed}
            fallback={<Trans>Find someone to play with.</Trans>}
          >
            <Trans>
              Minutes per player + seconds added after each move, or days for
              every move in a daily game.
            </Trans>
          </Show>
        </>
      }
      actions={
        <GameActionButton
          title={
            <Show when={count() > 2} fallback={<Trans>Find an opponent</Trans>}>
              <Trans>Find players</Trans>
            </Show>
          }
          successLabel={
            <Show
              when={count() > 2}
              fallback={<Trans>Opponent search accepted</Trans>}
            >
              <Trans>Player search accepted</Trans>
            </Show>
          }
          operation={() =>
            props.onFind(props.timed ? timeControl() : undefined)
          }
          variant="solid"
          fullWidth
          dataSet={{ testid: 'multiplayer-find' }}
        />
      }
    >
      <Show when={props.timed}>
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
      </Show>
    </GameSetupPanel>
  );
}
