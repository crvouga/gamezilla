import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client/turn-games-context';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameSearchState } from '@pkgs/ui-root-client/game-search-state';
import { P, Text } from '@pkgs/ui-root-client/text';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import type { JSX } from 'solid-js';
import { timeControlText } from './time-control-name';
import type { MultiplayerSearchRow } from './use-multiplayer-data';
import { useOfflineSince } from './use-offline-since';

/** A waiting search shows its time control and how long it has been looking. */
export function MultiplayerWaiting(props: {
  readonly search: MultiplayerSearchRow;
  readonly onStop: () => Promise<void>;
}): JSX.Element {
  const offlineSince = useOfflineSince();
  const rules = useTurnGames();
  const presentation = useGamePresentation();
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
      title={<Trans>Finding an opponent</Trans>}
      description={
        <P variant="inherit" testId="multiplayer-waiting">
          <Trans>
            Looking for a {timeControlText(props.search.time_control)}{' '}
            {gameName()} opponent.
          </Trans>
        </P>
      }
      elapsed={
        <>
          <Text variant="inherit" testId="multiplayer-waiting-seconds">
            {seconds()}
          </Text>{' '}
          <Trans>seconds</Trans>
        </>
      }
      actions={
        <GameActionButton
          title={
            <Trans>
              Stop<VisuallyHidden> finding an opponent</VisuallyHidden>
            </Trans>
          }
          operation={() => props.onStop()}
          dataSet={{ testid: 'multiplayer-stop' }}
        />
      }
    />
  );
}
