import { Plural, Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSearchState } from '@pkgs/ui-root-client-ts/game-search-state';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

/** A search under way, as the person sees it. */
export type MultiplayerSearchView = {
  /** How many players a game seats, the person included. */
  readonly players: number;
  readonly gameName: string;
  readonly goal?: string | undefined;
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

/** The search's one command: stopping it. */
export function MultiplayerStopSearch(props: {
  readonly multiple: boolean;
  readonly offline: boolean;
  readonly onStop: () => Promise<void>;
}): JSX.Element {
  return (
    <GameActionButton
      size="lg"
      fullWidth
      disabled={props.offline}
      loadingLabel={<Trans>Stopping search…</Trans>}
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
  /**
   * No connection: the card says the search waits for it and resumes by
   * itself, with a still mark in place of the spinner.
   */
  readonly offline?: boolean | undefined;
}): JSX.Element {
  return (
    <GameSearchState
      mark={
        props.offline === true ? (
          <WifiOffIcon size={24} color="warning" />
        ) : undefined
      }
      title={
        <Show
          when={props.offline !== true}
          fallback={<Trans>You're offline</Trans>}
        >
          <Show
            when={props.search.players > 2}
            fallback={<Trans>Finding an opponent</Trans>}
          >
            <Trans>Finding players</Trans>
          </Show>
        </Show>
      }
      description={
        <Show
          when={props.offline !== true}
          fallback={
            <P variant="inherit" testId="multiplayer-waiting-offline">
              {/* What still happens and what Stop does now: the search
                  goes on by itself, and Stop, which needs the connection,
                  is refused until it returns (the search keeps going). */}
              <Trans>
                Your search is still open. Reconnect to see its progress or stop
                it.
              </Trans>
            </P>
          }
        >
          <WaitingDescription search={props.search} />
        </Show>
      }
      elapsed={
        // Held while offline: the time searched so far, not a running count.
        <>
          <Show when={props.offline === true}>
            <Trans>Searched</Trans>{' '}
          </Show>
          <Show
            when={props.search.seconds >= 86_400}
            fallback={
              <>
                <Text variant="inherit" testId="multiplayer-waiting-seconds">
                  {props.search.seconds}
                </Text>{' '}
                <Trans>seconds</Trans>
              </>
            }
          >
            <Plural
              value={Math.floor(props.search.seconds / 86_400)}
              one="# day"
              other="# days"
            />
          </Show>
        </>
      }
    />
  );
}
