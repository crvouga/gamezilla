import type { Random } from '@pkgs/uuid-shared-ts/create-id';

/** The human-like bounds every thinking time keeps to. */
export const THINKING_TIME_BOUNDS = { minMs: 2_000, maxMs: 20_000 } as const;

const SECOND_MS = 1000;
/**
 * A thinking time is a whole number of seconds and a little more, never
 * close to the next second, so whoever watches counts the seconds the
 * Synthetic User meant.
 */
const JITTER_MS = 400;

/**
 * How long a Synthetic User thinks before its next move: a whole number of
 * seconds within its persona's bounds, never the same whole number of
 * seconds as its previous move. `previousMs` is `null` for its first move.
 */
export function drawThinkingMs(
  bounds: { readonly minMs: number; readonly maxMs: number },
  previousMs: number | null,
  random: Random
): number {
  const longest = THINKING_TIME_BOUNDS.maxMs / SECOND_MS - 1;
  const low = Math.min(
    longest,
    Math.max(
      THINKING_TIME_BOUNDS.minMs / SECOND_MS,
      Math.ceil(bounds.minMs / SECOND_MS)
    )
  );
  const high = Math.max(
    low,
    Math.min(longest, Math.floor(bounds.maxMs / SECOND_MS))
  );
  const previous =
    previousMs === null ? null : Math.floor(previousMs / SECOND_MS);
  const choices: number[] = [];
  for (let seconds = low; seconds <= high; seconds += 1)
    if (seconds !== previous) choices.push(seconds);
  // A persona narrower than two seconds still changes its thinking time.
  if (choices.length === 0)
    choices.push(previous === high ? Math.max(2, high - 1) : high);
  const seconds =
    choices[
      Math.min(choices.length - 1, Math.floor(random() * choices.length))
    ]!;
  return seconds * SECOND_MS + Math.floor(random() * JITTER_MS);
}
