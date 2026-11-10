/** A Synthetic User never plays more games in a row against the same opponent. */
export const MAX_GAMES_IN_A_ROW = 3;

/** How many games in a row a Synthetic User has played against one opponent. */
export type OpponentStreak = {
  readonly opponent: string;
  readonly games: number;
};

/** The streak once a game against `opponent` starts. */
export function streakAfterGame(
  streak: OpponentStreak | null,
  opponent: string
): OpponentStreak {
  return streak !== null && streak.opponent === opponent
    ? { opponent, games: streak.games + 1 }
    : { opponent, games: 1 };
}

/**
 * Whether a Synthetic User wants another game against the opponent it just
 * played: by its persona's rematch weight, and never a fourth in a row.
 */
export function wantsRematch(
  streak: OpponentStreak | null,
  rematchWeight: number,
  draw: number
): boolean {
  if ((streak?.games ?? 1) >= MAX_GAMES_IN_A_ROW) return false;
  return draw < Math.max(0, Math.min(1, rematchWeight));
}
