import { t } from '@lingui/core/macro';

const SECOND_MS = 1000;
const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;
const DAY_MINUTES = 24 * 60;

export const daysText = (days: number): string =>
  days === 1 ? t`1 day` : t`${days} days`;
export const hoursText = (hours: number): string =>
  hours === 1 ? t`1 hour` : t`${hours} hours`;
export const minutesText = (minutes: number): string =>
  minutes === 1 ? t`1 minute` : t`${minutes} minutes`;
const secondsText = (seconds: number): string =>
  seconds === 1 ? t`1 second` : t`${seconds} seconds`;

/** Two neighbouring units, the smaller left out when it is zero. */
function pair(larger: string, smaller: string, rest: number): string {
  return rest === 0 ? larger : `${larger} ${smaller}`;
}

/**
 * Time left in words, for a listener: `10 seconds`, `6 hours`, `1 day 2
 * hours`. Rounded up to the smaller unit named, so it never says less than
 * is left.
 */
export function timeLeftWords(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / SECOND_MS);
  if (seconds < MINUTE_S) return secondsText(seconds);
  if (seconds < HOUR_S)
    return pair(
      minutesText(Math.floor(seconds / MINUTE_S)),
      secondsText(seconds % MINUTE_S),
      seconds % MINUTE_S
    );
  const minutes = Math.ceil(seconds / MINUTE_S);
  if (minutes < DAY_MINUTES)
    return pair(
      hoursText(Math.floor(minutes / 60)),
      minutesText(minutes % 60),
      minutes % 60
    );
  const hours = Math.ceil(minutes / 60);
  return pair(
    daysText(Math.floor(hours / 24)),
    hoursText(hours % 24),
    hours % 24
  );
}
