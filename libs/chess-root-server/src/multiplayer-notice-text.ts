import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import type { MultiplayerNoticeResult } from '@libs/chess-matchmaking-shared/multiplayer-notices';

type EndedGame = Pick<MultiplayerGame, 'reason' | 'white_ms'>;

/** The side whose clock ran out, for the reasons that name it. */
export function flaggedSide(game: EndedGame): 'white' | 'black' | null {
  if (
    game.reason !== 'timeout' &&
    game.reason !== 'timeout vs insufficient material'
  )
    return null;
  return game.white_ms === 0 ? 'white' : 'black';
}

const REASONS: Readonly<Record<string, string>> = {
  checkmate: 'By checkmate.',
  resignation: 'By resignation.',
  agreement: 'Drawn by agreement.',
  stalemate: 'By stalemate.',
  repetition: 'By repetition.',
  'insufficient material': 'Neither side can checkmate.',
  'fifty moves': 'By the fifty-move rule.',
  'first move missed': "The first move wasn't made in time.",
  'account deletion': 'An account was deleted.',
};

/** Why the game ended, in the words the multiplayer result gives. */
export function resultReasonText(game: EndedGame): string | undefined {
  const flagged = flaggedSide(game);
  if (flagged !== null) {
    const side = flagged === 'white' ? 'White' : 'Black';
    return game.reason === 'timeout'
      ? `${side} ran out of time.`
      : `${side} ran out of time, but the other side cannot checkmate.`;
  }
  return game.reason === null ? undefined : REASONS[game.reason];
}

/** What a result notice says first: how the daily game ended for its reader. */
export function resultNoticeTitle(
  result: MultiplayerNoticeResult,
  opponent: string
): string {
  if (result === 'won') return `You won your daily game against ${opponent}`;
  if (result === 'lost') return `You lost your daily game against ${opponent}`;
  if (result === 'drawn') return `Your daily game against ${opponent} is drawn`;
  return `Your daily game against ${opponent} was aborted`;
}

export function turnNoticeTitle(opponent: string): string {
  return `It's your turn in your daily game against ${opponent}`;
}
