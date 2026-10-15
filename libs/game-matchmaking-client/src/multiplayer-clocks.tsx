import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import type { MultiplayerSide } from '@libs/game-matchmaking-shared/multiplayer-clock';
import {
  clockLeftMs,
  clockLowOnTime,
  clockRunning,
  sideToMove,
} from '@libs/game-matchmaking-shared/multiplayer-clock';
import { isDailyTimeControl } from '@libs/game-matchmaking-shared/time-control';
import { t } from '@lingui/core/macro';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { useGameSideLabel } from '@pkgs/turn-game-client/use-game-side-label';
import { GameClock } from '@pkgs/ui-root-client/game-clock';
import type { JSX } from 'solid-js';
import {
  clockLabel,
  dailyClockParts,
  dailyClockStepMs,
} from './multiplayer-format';
import { daysText, hoursText, minutesText } from './multiplayer-time-left';
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

/** What a listener hears for one clock: whose, how long, and if it is low. */
function clockSpoken(
  side: MultiplayerSide,
  time: { readonly spoken: string; readonly low: boolean }
): string {
  const left = time.spoken;
  if (side === 'white')
    return time.low
      ? t`White has ${left} left and is low on time`
      : t`White has ${left} left`;
  return time.low
    ? t`Black has ${left} left and is low on time`
    : t`Black has ${left} left`;
}

/** One side's multiplayer clock, shown to both people and to watchers. */
export function MultiplayerClock(props: {
  readonly game: MultiplayerGame;
  readonly side: MultiplayerSide;
}): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const offlineSince = useOfflineSince();
  const daily = () => isDailyTimeControl(props.game.time_control);
  const time = createTimedValue(
    (now) => {
      const at = offlineSince() ?? now;
      const left = clockLeftMs(props.game, props.side, at);
      const low = clockLowOnTime(props.game, props.side, at);
      return daily()
        ? { shown: dailyClockLabel(left), spoken: dailyClockSpoken(left), low }
        : { shown: clockLabel(left), spoken: clockLabel(left), low };
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
      label={gameSideLabel(props.game.fen, props.side)}
      low={time().low}
      value={time().shown}
      dataSet={{ testid: `multiplayer-${props.side}-clock` }}
      ariaLabel={clockSpoken(props.side, time())}
    />
  );
}
