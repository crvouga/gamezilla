import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSearchState } from '@pkgs/ui-root-client-ts/game-search-state';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';

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
                Looking for a {control()} {props.search.gameName} opponent.
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
              {props.search.gameName} at {control()}. A game needs {count()}{' '}
              players including you.
            </Trans>
          )}
        </Show>
      </Show>
    </P>
  );
}

function StopSearch(props: {
  readonly multiple: boolean;
  readonly onStop: () => Promise<void>;
}): JSX.Element {
  return (
    <GameActionButton
      title={
        <Show
          when={props.multiple}
          fallback={
            <Trans>
              Stop<VisuallyHidden> finding an opponent</VisuallyHidden>
            </Trans>
          }
        >
          <Trans>
            Stop<VisuallyHidden> finding players</VisuallyHidden>
          </Trans>
        </Show>
      }
      operation={() => props.onStop()}
      dataSet={{ testid: 'multiplayer-stop' }}
    />
  );
}

/** A waiting search shows its time control and how long it has been looking. */
export function MultiplayerWaiting(props: {
  readonly search: MultiplayerSearchView;
  readonly onStop: () => Promise<void>;
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
      elapsed={
        <>
          <Text variant="inherit" testId="multiplayer-waiting-seconds">
            {props.search.seconds}
          </Text>{' '}
          <Trans>seconds</Trans>
        </>
      }
      actions={
        <StopSearch multiple={props.search.players > 2} onStop={props.onStop} />
      }
    />
  );
}
