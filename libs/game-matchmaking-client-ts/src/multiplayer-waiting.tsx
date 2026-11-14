import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSearchState } from '@pkgs/ui-root-client-ts/game-search-state';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import { timeControlWords } from './time-control-name';

/** A search under way, as the person sees it. */
export type MultiplayerSearchView = {
  /** How many players a game seats, the person included. */
  readonly players: number;
  readonly gameName: string;
  /** Its time control as people write it (`5+0`); `null` when untimed. */
  readonly timeControl: string | null;
  /** How long it has been looking; frozen while offline. */
  readonly seconds: number;
};

/** A clock in plain words that never breaks across lines (`5 min + 3 sec`). */
function wordsKeptTogether(control: string): string {
  return timeControlWords(control).replaceAll(' ', '\u00a0');
}

function WaitingDescription(props: {
  readonly search: MultiplayerSearchView;
}): JSX.Element {
  const count = () => props.search.players;
  return (
    <P variant="inherit" testId="multiplayer-waiting">
      <Show
        when={count() > 2}
        fallback={
          <Show
            when={props.search.timeControl}
            fallback={
              <Trans>Looking for a {props.search.gameName} opponent.</Trans>
            }
          >
            {(control) => (
              <Trans>
                Looking for a {props.search.gameName} opponent at{' '}
                {wordsKeptTogether(control())}.
              </Trans>
            )}
          </Show>
        }
      >
        <Show
          when={props.search.timeControl}
          fallback={
            <Trans>
              Looking for {count() - 1} other players for{' '}
              {props.search.gameName}. A game needs {count()} players including
              you.
            </Trans>
          }
        >
          {(control) => (
            <Trans>
              Looking for {count() - 1} other players for{' '}
              {props.search.gameName} at {wordsKeptTogether(control())}. A game
              needs {count()} players including you.
            </Trans>
          )}
        </Show>
      </Show>
    </P>
  );
}

/** The search's one command: stopping it. */
export function MultiplayerStopSearch(props: {
  readonly multiple: boolean;
  readonly onStop: () => Promise<void>;
}): JSX.Element {
  return (
    <GameActionButton
      size="lg"
      fullWidth
      title={
        <Show
          when={props.multiple}
          fallback={
            <Trans>
              Stop searching<VisuallyHidden> for an opponent</VisuallyHidden>
            </Trans>
          }
        >
          <Trans>
            Stop searching<VisuallyHidden> for players</VisuallyHidden>
          </Trans>
        </Show>
      }
      operation={() => props.onStop()}
      dataSet={{ testid: 'multiplayer-stop' }}
    />
  );
}

/** Seconds as a running clock: `0:42`, `12:05`. */
export function elapsedClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${String(minutes)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A waiting search: what it looks for, how long it has been looking as a
 * running clock, and that the game starts by itself once it finds someone.
 */
export function MultiplayerWaiting(props: {
  readonly search: MultiplayerSearchView;
}): JSX.Element {
  return (
    <GameSearchState
      title={
        <Show
          when={props.search.players > 2}
          fallback={<Trans>Finding an opponent</Trans>}
        >
          <Trans>Finding players</Trans>
        </Show>
      }
      description={<WaitingDescription search={props.search} />}
      hint={
        <Show
          when={props.search.players > 2}
          fallback={
            <Trans>
              The game starts on its own as soon as someone is found.
            </Trans>
          }
        >
          <Trans>The game starts on its own once every seat is filled.</Trans>
        </Show>
      }
      elapsed={
        <>
          <Text variant="inherit" aria-hidden>
            {elapsedClock(props.search.seconds)}
          </Text>
          <VisuallyHidden>
            <Text variant="inherit" testId="multiplayer-waiting-seconds">
              {props.search.seconds}
            </Text>{' '}
            <Trans>seconds</Trans>
          </VisuallyHidden>
        </>
      }
    />
  );
}
