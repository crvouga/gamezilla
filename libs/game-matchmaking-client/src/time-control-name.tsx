import { daysPerMoveOf } from '@libs/game-matchmaking-shared/time-control';
import { t } from '@lingui/core/macro';

/**
 * A time control as people write it: `5+0`, or a daily time control's days
 * for every move.
 */
export function timeControlText(id: string | null | undefined): string {
  const days = daysPerMoveOf(id);
  if (days === 0) return id?.split('/').at(-1) ?? '';
  return days === 1 ? t`1 day per move` : t`${days} days per move`;
}

/** The short name a time control's choice carries: `5+0`, `3 days`. */
export function timeControlChoiceText(id: string): string {
  const days = daysPerMoveOf(id);
  if (days === 0) return id.split('/').at(-1) ?? '';
  return days === 1 ? t`1 day` : t`${days} days`;
}
