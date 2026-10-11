import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import type { MultiplayerSide } from '@libs/chess-matchmaking-shared/multiplayer-clock';
import {
  clockLeftMs,
  clockRunning,
  sideToMove,
} from '@libs/chess-matchmaking-shared/multiplayer-clock';
import { isDailyTimeControl } from '@libs/chess-matchmaking-shared/time-control';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { GameClock } from '@pkgs/ui-root-client/game-clock';
import { type JSX, Show } from 'solid-js';
import {
  clockLabel,
  dailyClockParts,
  dailyClockStepMs,
} from './multiplayer-format';
import { useOfflineSince } from './use-offline-since';

/** A daily game's time left, short enough for the seat: `2d 5h`, `5h 12m`. */
function dailyClockLabel(ms: number): string {
  const parts = dailyClockParts(ms);
  if (parts.unit === 'seconds') return clockLabel(parts.ms);
  if (parts.unit === 'hours') return t`${parts.hours}h ${parts.minutes}m`;
  return parts.hours === 0
    ? t`${parts.days}d`
    : t`${parts.days}d ${parts.hours}h`;
}

const daysText = (days: number): string =>
  days === 1 ? t`1 day` : t`${days} days`;
const hoursText = (hours: number): string =>
  hours === 1 ? t`1 hour` : t`${hours} hours`;
const minutesText = (minutes: number): string =>
  minutes === 1 ? t`1 minute` : t`${minutes} minutes`;

/** The same time left as a listener hears it: `2 days 5 hours`. */
function dailyClockSpoken(ms: number): string {
  const parts = dailyClockParts(ms);
  if (parts.unit === 'seconds') return clockLabel(parts.ms);
  if (parts.unit === 'hours')
    return `${hoursText(parts.hours)} ${minutesText(parts.minutes)}`;
  return parts.hours === 0
    ? daysText(parts.days)
    : `${daysText(parts.days)} ${hoursText(parts.hours)}`;
}

/** One side's multiplayer clock, shown to both people and to watchers. */
export function MultiplayerClock(props: {
  readonly game: MultiplayerGame;
  readonly side: MultiplayerSide;
}): JSX.Element {
  const offlineSince = useOfflineSince();
  const daily = () => isDailyTimeControl(props.game.time_control);
  const time = createTimedValue(
    (now) => {
      const left = clockLeftMs(props.game, props.side, offlineSince() ?? now);
      return daily()
        ? { shown: dailyClockLabel(left), spoken: dailyClockSpoken(left) }
        : { shown: clockLabel(left), spoken: clockLabel(left) };
    },
    (_value, now) => {
      if (
        offlineSince() !== null ||
        !clockRunning(props.game) ||
        sideToMove(props.game) !== props.side
      )
        return null;
      const left = clockLeftMs(props.game, props.side, now);
      if (left <= 0) return null;
      return now + (daily() ? dailyClockStepMs(left) : ((left - 1) % 1000) + 1);
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
      value={time().shown}
      dataSet={{ testid: `multiplayer-${props.side}-clock` }}
      ariaLabel={
        props.side === 'white'
          ? t`White has ${time().spoken} left`
          : t`Black has ${time().spoken} left`
      }
    />
  );
}
