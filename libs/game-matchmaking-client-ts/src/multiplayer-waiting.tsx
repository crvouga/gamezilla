import { Plural, Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSearchStage } from '@pkgs/ui-root-client-ts/game-search-stage';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { timeControlWords } from './time-control-name';

/** A search under way, as the person sees it. */
export type MultiplayerSearchView = {
  /** How many players a game seats, the person included. */
  readonly players: number;
  readonly gameName: string;
  readonly motif: GameTileMotif;
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

/** Who is searching, as their own seat shows them. */
export type MultiplayerSearchYou = {
  readonly avatar: JSX.Element;
  readonly name: JSX.Element;
};

/**
 * The person's own seat under the waiting board: who they are, and the
 * clock they chose at the seat's far edge (an untimed game has none).
 */
function SearchSeat(props: {
  readonly you: MultiplayerSearchYou;
  readonly timeControl: string | null;
}): JSX.Element {
  return (
    <GamePlayerBar
      avatar={props.you.avatar}
      name={props.you.name}
      trailing={
        <Show when={props.timeControl}>
          {(control) => (
            <Badge
              intent="neutral"
              label={
                <Text variant="inherit" testId="multiplayer-waiting-clock">
                  {timeControlWords(control())}
                </Text>
              }
            />
          )}
        </Show>
      }
      dataSet={{ testid: 'multiplayer-search-seat' }}
    />
  );
}

/**
 * A waiting search, on the board's place: its state (`Searching…`, what is
 * sought, how long) over the person's seat with the clock they chose.
 */
export function MultiplayerWaiting(props: {
  readonly search: MultiplayerSearchView;
  /** The person's own seat; the wait names no one without it. */
  readonly you?: MultiplayerSearchYou | undefined;
  /**
   * No connection: the stage says the search waits for it and resumes by
   * itself, with a still mark in place of the spinner.
   */
  readonly offline?: boolean | undefined;
}): JSX.Element {
  return (
    <GameSearchStage
      motif={props.search.motif}
      mark={
        props.offline === true ? (
          <WifiOffIcon size={24} color="warning" />
        ) : undefined
      }
      seat={
        <Show when={props.you}>
          {(you) => (
            <SearchSeat you={you()} timeControl={props.search.timeControl} />
          )}
        </Show>
      }
      title={
        <Show
          when={props.offline !== true}
          fallback={<Trans>You're offline</Trans>}
        >
          <Trans>Searching…</Trans>
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
