import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameSearchState } from '@pkgs/ui-root-client/game-search-state';
import type { JSX } from 'solid-js';
import type { MultiplayerSearchRow } from './use-multiplayer-data';
import { useOfflineSince } from './use-offline-since';

/** A waiting search shows its time control and how long it has been looking. */
export function MultiplayerWaiting(props: {
  readonly search: MultiplayerSearchRow;
  readonly onStop: () => Promise<void>;
}): JSX.Element {
  const offlineSince = useOfflineSince();
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
      title={<Trans>Finding your rival</Trans>}
      description={
        <p data-testid="multiplayer-waiting">
          <Trans>
            Looking for a {props.search.time_control ?? ''} chess opponent.
          </Trans>
        </p>
      }
      elapsed={
        <span data-testid="multiplayer-waiting-seconds">{seconds()}</span>
      }
      actions={
        <GameActionButton
          title={<Trans>Stop finding an opponent</Trans>}
          operation={() => props.onStop()}
          dataSet={{ testid: 'multiplayer-stop' }}
        />
      }
    />
  );
}
