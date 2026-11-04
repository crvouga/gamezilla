import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
  timeControlOf,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { createSignal, type JSX, Show } from 'solid-js';
import { SpeedName } from './speed-name';
import { timeControlChoiceText, timeControlText } from './time-control-name';

/**
 * What the search will find, right above it: a rated game, and its clock
 * (the chosen time control and its speed) or none.
 */
function MatchConditions(props: {
  readonly timed: boolean;
  readonly timeControl: string;
}): JSX.Element {
  const speed = () => timeControlOf(props.timeControl)?.speed;
  return (
    <StackHorizontal
      align="center"
      gap="sm"
      wrap
      aria-label={t`Match conditions`}
      dataSet={{ testid: 'multiplayer-find-conditions' }}
    >
      <Badge intent="neutral" label={<Trans>Rated</Trans>} />
      <Show
        when={props.timed}
        fallback={<Badge intent="neutral" label={<Trans>Untimed</Trans>} />}
      >
        <Badge intent="neutral" label={timeControlText(props.timeControl)} />
        <Show when={speed()}>
          {(name) => (
            <Badge intent="neutral" label={<SpeedName speed={name()} />} />
          )}
        </Show>
      </Show>
    </StackHorizontal>
  );
}

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
  // A phone's button spans its column; beside a wide board it is sized to
  // its words, never stretched across the whole column.
  const mode = useLayoutMode();
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
          fullWidth={mode() !== 'wide'}
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
      <MatchConditions timed={props.timed} timeControl={timeControl()} />
    </GameSetupPanel>
  );
}
