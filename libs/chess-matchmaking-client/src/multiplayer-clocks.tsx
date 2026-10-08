import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import type { MultiplayerSide } from '@libs/chess-matchmaking-shared/multiplayer-clock';
import {
  clockLeftMs,
  clockRunning,
  sideToMove,
} from '@libs/chess-matchmaking-shared/multiplayer-clock';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { GameClock } from '@pkgs/ui-root-client/game-clock';
import { type JSX, Show } from 'solid-js';
import { clockLabel } from './multiplayer-format';
import { useOfflineSince } from './use-offline-since';

function MultiplayerClock(props: {
  readonly game: MultiplayerGame;
  readonly side: MultiplayerSide;
}): JSX.Element {
  const offlineSince = useOfflineSince();
  const label = createTimedValue(
    (now) =>
      clockLabel(clockLeftMs(props.game, props.side, offlineSince() ?? now)),
    (_value, now) => {
      if (
        offlineSince() !== null ||
        !clockRunning(props.game) ||
        sideToMove(props.game) !== props.side
      )
        return null;
      const left = clockLeftMs(props.game, props.side, now);
      return left <= 0 ? null : now + (((left - 1) % 1000) + 1);
    }
  );
  return (
    <GameClock
      active={clockRunning(props.game) && sideToMove(props.game) === props.side}
      label={
        <Show when={props.side === 'white'} fallback={<Trans>Black</Trans>}>
          <Trans>White</Trans>
        </Show>
      }
      value={label()}
      dataSet={{ testid: `multiplayer-${props.side}-clock` }}
      ariaLabel={
        props.side === 'white'
          ? t`White has ${label()} left`
          : t`Black has ${label()} left`
      }
    />
  );
}

/** Both multiplayer clocks, shown to both people. */
export function MultiplayerClocks(props: {
  readonly game: MultiplayerGame;
}): JSX.Element {
  return (
    <div
      class="box flex-row gap-4"
      data-component="MultiplayerClocks"
      data-testid="multiplayer-clocks"
    >
      <MultiplayerClock game={props.game} side="white" />
      <MultiplayerClock game={props.game} side="black" />
    </div>
  );
}
