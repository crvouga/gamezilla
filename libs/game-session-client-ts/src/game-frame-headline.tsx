import { t } from '@lingui/core/macro';
import type { GameStanding } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { formatOrdinal } from '@pkgs/ui-root-client-ts/game-ordinal';
import { sideNames } from './side-names';

/**
 * What the game-over headline says, before it is put into words: a draw
 * (every seat shares first place), the viewer's own finish when they sat at
 * the table, and otherwise who won.
 */
export type FrameHeadline =
  | { readonly kind: 'draw' }
  | { readonly kind: 'you-win' }
  | { readonly kind: 'you-placed'; readonly place: number }
  | { readonly kind: 'won'; readonly winners: readonly GameSide[] };

export function frameHeadline(
  standings: readonly GameStanding[],
  viewer: GameSide | null
): FrameHeadline {
  const winners = standings
    .filter((standing) => standing.place === 1)
    .map((standing) => standing.side);
  if (standings.length > 1 && winners.length === standings.length)
    return { kind: 'draw' };
  const own = standings.find((standing) => standing.side === viewer);
  if (own === undefined) return { kind: 'won', winners };
  return own.place === 1
    ? { kind: 'you-win' }
    : { kind: 'you-placed', place: own.place };
}

/** The headline in words: "You win", "You came 2nd", "Erin wins", "Draw". */
export function frameHeadlineText(
  headline: FrameHeadline,
  nameOf: (side: GameSide) => string,
  locale: string
): string {
  if (headline.kind === 'draw') return t`Draw`;
  if (headline.kind === 'you-win') return t`You win`;
  if (headline.kind === 'you-placed') {
    const place = formatOrdinal(headline.place, locale);
    return t`You came ${place}`;
  }
  if (headline.winners.length === 1) {
    const name = nameOf(headline.winners[0]!);
    return t`${name} wins`;
  }
  const names = sideNames(headline.winners.map(nameOf));
  return t`${names} win`;
}

/** One standings row before its avatar: who, where they placed, their score. */
export type FrameStandingRow = {
  readonly id: GameSide;
  readonly place: number;
  readonly name: string;
  readonly score: string | null;
  readonly you: boolean;
  readonly testId: string;
};

/** The standings in finishing order (first place first, ties in seat order). */
export function frameStandingRows(
  standings: readonly GameStanding[],
  viewer: GameSide | null,
  nameOf: (side: GameSide) => string
): readonly FrameStandingRow[] {
  return [...standings]
    .sort((a, b) => a.place - b.place)
    .map((standing) => ({
      id: standing.side,
      place: standing.place,
      name: nameOf(standing.side),
      score: standing.score,
      you: standing.side === viewer,
      testId: `custom-game-standing-${standing.side}`,
    }));
}
