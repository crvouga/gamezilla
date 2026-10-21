/**
 * The countdown a matched game shows under its board until both people have
 * made their first move: while the private setups are being chosen, the
 * seconds left to choose them; then the seconds left for the first move due.
 */

import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { multiplayerText } from './multiplayer-reads';

/** The countdown's test id on the matched game's screen. */
export const FIRST_MOVE_COUNTDOWN = 'multiplayer-first-move-countdown';

/**
 * The whole seconds `actor`'s screen counts down (rounded up, as it shows
 * them), or `null` when it shows no countdown.
 */
export async function firstMoveCountdownSeconds(
  s: ProductHarness,
  actor: string
): Promise<number | null> {
  await bringToFront(s, actor);
  const text = await multiplayerText(s, actor, FIRST_MOVE_COUNTDOWN);
  if (text === null) return null;
  const seconds = /(\d+)\D*$/.exec(text)?.[1];
  if (seconds === undefined)
    throw new Error(`${actor}'s countdown shows no seconds: "${text}"`);
  return Number(seconds);
}
