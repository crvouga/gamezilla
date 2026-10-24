import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSearchState } from '@pkgs/ui-root-client-ts/game-search-state';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import { timeControlText } from './time-control-name';
import type { MultiplayerSearchRow } from './use-multiplayer-data';
import { useOfflineSince } from './use-offline-since';

function WaitingDescription(props: {
  readonly search: MultiplayerSearchRow;
  readonly count: number;
  readonly gameName: string;
}): JSX.Element {
  return (
    <P variant="inherit" testId="multiplayer-waiting">
      <Show
        when={props.count > 2}
        fallback={
          <Trans>
            Looking for a {timeControlText(props.search.time_control)}{' '}
            {props.gameName} opponent.
          </Trans>
        }
      >
        <Trans>
          Looking for {props.count - 1} other players for {props.gameName} at{' '}
          {timeControlText(props.search.time_control)}. A game needs{' '}
          {props.count} players including you.
        </Trans>
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
  readonly search: MultiplayerSearchRow;
  readonly onStop: () => Promise<void>;
}): JSX.Element {
  const offlineSince = useOfflineSince();
  const rules = useTurnGames();
  const presentation = useGamePresentation();
  const count = () =>
    gameSides(rules.forControl(props.search.time_control ?? '')).length;
  const gameName = () =>
    presentation(
      rules.forControl(props.search.time_control ?? '').initial()
    ).name();
  const seconds = createTimedValue(
    (now) => {
      const at = offlineSince() ?? now;
      return Math.max(
        0,
        Math.floor((at - (props.search.joined_at_ms ?? at)) / 1000)
      );
    },
    (value) =>
      offlineSince() === null
        ? (props.search.joined_at_ms ?? 0) + (value + 1) * 1000
        : null
  );
  return (
    <GameSearchState
      title={
        <Show when={count() > 2} fallback={<Trans>Finding an opponent</Trans>}>
          <Trans>Finding players</Trans>
        </Show>
      }
      description={
        <WaitingDescription
          search={props.search}
          count={count()}
          gameName={gameName()}
        />
      }
      elapsed={
        <>
          <Text variant="inherit" testId="multiplayer-waiting-seconds">
            {seconds()}
          </Text>{' '}
          <Trans>seconds</Trans>
        </>
      }
      actions={<StopSearch multiple={count() > 2} onStop={props.onStop} />}
    />
  );
}
