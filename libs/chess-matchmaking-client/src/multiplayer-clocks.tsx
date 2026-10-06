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
    <p class="box flex-row gap-2" role="timer" aria-live="off">
      <span class="text textLabel">
        <Show when={props.side === 'white'} fallback={<Trans>Black</Trans>}>
          <Trans>White</Trans>
        </Show>
      </span>
      <span
        class="textMono"
        data-testid={`multiplayer-${props.side}-clock`}
        aria-label={
          props.side === 'white'
            ? t`White has ${label()} left`
            : t`Black has ${label()} left`
        }
      >
        {label()}
      </span>
    </p>
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
