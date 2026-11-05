import {
  DEFAULT_TIME_CONTROL,
  TIME_CONTROLS,
  timeControlKey,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { GameFact, GameFacts } from '@pkgs/ui-root-client-ts/game-facts';
import { GameSetupPanel } from '@pkgs/ui-root-client-ts/game-setup-panel';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX, Show } from 'solid-js';
import { SpeedName } from './speed-name';
import { timeControlChoiceText, timeControlText } from './time-control-name';

/**
 * What the search will find, right above its command, as the game's
 * settings line (`Rated · Untimed`, or `Rated · 5+0` at the chosen time
 * control), in the same words and quiet style a game's title carries
 * (`Unrated · Untimed`). The time control is changed by its choices above;
 * a search is always rated.
 */
function MatchConditions(props: {
  readonly timed: boolean;
  readonly timeControl: string;
}): JSX.Element {
  return (
    <GameFacts testId="multiplayer-find-conditions">
      <GameFact label={<Trans>Rated</Trans>} />
      <GameFact
        label={
          <Show when={props.timed} fallback={<Trans>Untimed</Trans>}>
            {timeControlText(props.timeControl)}
          </Show>
        }
      />
    </GameFacts>
  );
}

/**
 * Only what the choice needs said: how many players a bigger game finds,
 * and what a time control's numbers mean. A plain two-player search says
 * nothing more than its conditions line.
 */
function FindDescription(props: {
  readonly count: number;
  readonly timed: boolean;
}): JSX.Element {
  return (
    <>
      <Show when={props.count > 2}>
        <Show
          when={props.timed}
          fallback={
            <Trans>
              A game needs {props.count} players including you. Find{' '}
              {props.count - 1} other players.
            </Trans>
          }
        >
          <Trans>
            A game needs {props.count} players including you. Find{' '}
            {props.count - 1} other players at the same clock choice.
          </Trans>
        </Show>{' '}
      </Show>
      <Show when={props.timed}>
        <Trans>
          Minutes per player + seconds added after each move, or days for every
          move in a daily game.
        </Trans>
      </Show>
    </>
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
  /** The person's ratings, in the same card as the search. */
  readonly aside?: JSX.Element | undefined;
  /** Under the search and ratings, past a hairline: how a search works. */
  readonly details?: JSX.Element | undefined;
  /** Wide: how a search works as the card's third column (`GameSetupPanel`). */
  readonly detailsBeside?: boolean | undefined;
}): JSX.Element {
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  const count = () => props.players;
  return (
    <GameSetupPanel
      title={<Trans>New game</Trans>}
      aside={props.aside}
      details={props.details}
      detailsBeside={props.detailsBeside}
      description={
        <Show when={count() > 2 || props.timed}>
          <FindDescription count={count()} timed={props.timed} />
        </Show>
      }
      actions={
        // Grows to its half of the card, so the note wraps under the command.
        <StackVertical gap="sm" grow>
          <GameActionButton
            title={
              <Show
                when={count() > 2}
                fallback={<Trans>Find an opponent</Trans>}
              >
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
            // The search's one command spans its card on every size.
            fullWidth
            dataSet={{ testid: 'multiplayer-find' }}
          />
          <P variant="caption" tone="secondary" testId="multiplayer-find-space">
            <Trans>
              The game opens in this space, where everyone can watch. Your
              opponent plays from their own space.
            </Trans>
          </P>
        </StackVertical>
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
