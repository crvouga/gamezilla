/** The feed settings in words: what each row, tag and spoken line says. */

import type {
  PuzzleAutoAdvance,
  PuzzleFeedConfig,
  PuzzleFeedHistoryFilter,
} from '@libs/game-puzzle-shared-ts/feed-config';
import { t } from '@lingui/core/macro';

/** How a game names a theme. */
export type PuzzleThemeLabel = (theme: string) => string;

/** Puzzle ratings are 400–3000: four tabular digits, padded with figure space. */
const RATING_SLOT_DIGITS = 4;

/** `rating` in a slot four digits wide, so a changing target never reflows. */
export function ratingSlot(rating: number): string {
  const digits = String(Math.max(0, Math.round(rating)));
  if (digits.length >= RATING_SLOT_DIGITS) return digits;
  return ' '.repeat(RATING_SLOT_DIGITS - digits.length) + digits;
}

export function historyFilterLabel(filter: PuzzleFeedHistoryFilter): string {
  switch (filter) {
    case 'any':
      return t`Any`;
    case 'neverSeen':
      return t`Unseen`;
    case 'seen':
      return t`Seen`;
    case 'failed':
      return t`Failed`;
  }
}

export function themesSummary(
  themes: readonly string[],
  themeLabel: PuzzleThemeLabel
): string {
  if (themes.length === 0) return t`All themes`;
  if (themes.length === 1) {
    const first = themes[0];
    return first === undefined ? t`All themes` : themeLabel(first);
  }
  return t`${themes.length} themes`;
}

/** What happens after a solve, as a row's value. */
export function autoAdvanceLabel(autoAdvance: PuzzleAutoAdvance): string {
  switch (autoAdvance) {
    case 'off':
      return t`Wait for me`;
    case 'after1s':
      return t`Next after 1 s`;
    case 'immediate':
      return t`Next immediately`;
  }
}

/** "Auto target 1500" / "Custom target 1550". */
export function targetLabel(config: PuzzleFeedConfig, rating: number): string {
  const slot = ratingSlot(rating);
  return config.mode === 'auto'
    ? t`Auto target ${slot}`
    : t`Custom target ${slot}`;
}

/** The whole feed in one spoken sentence, for the control that opens it. */
export function feedAccessibleLabel(
  config: PuzzleFeedConfig,
  rating: number,
  themeLabel: PuzzleThemeLabel
): string {
  const mode = config.mode === 'auto' ? t`Automatic` : t`Custom`;
  const history = historyFilterLabel(config.historyFilter);
  const themes = themesSummary(config.themes, themeLabel);
  const advance =
    config.autoAdvance === 'off'
      ? t`Manual next puzzle`
      : config.autoAdvance === 'after1s'
        ? t`Next puzzle after one second`
        : t`Next puzzle immediately`;
  return t`Puzzle feed. ${mode} target ${rating}. History: ${history}. Themes: ${themes}. ${advance}.`;
}
