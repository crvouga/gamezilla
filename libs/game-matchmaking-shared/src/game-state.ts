import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';

export type MultiplayerOutcome =
  | 'ongoing'
  | 'white'
  | 'black'
  | 'draw'
  | 'aborted';

export type MultiplayerGame = {
  readonly id: string;
  readonly white_id: string;
  readonly black_id: string;
  readonly fen: string;
  readonly pgn: string;
  /** Accepted moves; both people have moved once it reaches two. */
  readonly revision: number;
  readonly turn: string;
  readonly outcome: MultiplayerOutcome;
  readonly reason: string | null;
  readonly time_control: string | null;
  readonly white_ms: number | null;
  readonly black_ms: number | null;
  /** Server time the running clock (or the first-move wait) last started. */
  readonly clock_at_ms: number | null;
  /** A trusted shared pause; independent of every person's connection. */
  readonly paused_at_ms: number | null;
  readonly draw_offer_by: string | null;
  readonly rematch_offer_by: string | null;
  readonly rematch_of: string | null;
  /** Each person's rating for the game's speed as shown when it started. */
  readonly white_rating: string | null;
  readonly black_rating: string | null;
  readonly white_rating_diff: number | null;
  readonly black_rating_diff: number | null;
};

export const MULTIPLAYER_GAME_COLUMNS = [
  'id',
  'white_id',
  'black_id',
  'fen',
  'pgn',
  'revision',
  'turn',
  'outcome',
  'reason',
  'time_control',
  'white_ms',
  'black_ms',
  'clock_at_ms',
  'paused_at_ms',
  'draw_offer_by',
  'rematch_offer_by',
  'rematch_of',
  'white_rating',
  'black_rating',
  'white_rating_diff',
  'black_rating_diff',
] as const;

/** Both people have made their first move: clocks run, aborting ends. */
export function bothHaveMoved(
  game: Pick<MultiplayerGame, 'revision'>
): boolean {
  return game.revision >= 2;
}

export function otherPerson(game: MultiplayerGame, ownerId: string): string {
  return game.white_id === ownerId ? game.black_id : game.white_id;
}

export function isFinished(outcome: MultiplayerOutcome): boolean {
  return outcome === 'white' || outcome === 'black' || outcome === 'draw';
}

/** A game that ended keeps no offer and no side to move. */
export function endMultiplayerGame(
  game: MultiplayerGame,
  outcome: Exclude<MultiplayerOutcome, 'ongoing'>,
  reason: string
): MultiplayerGame {
  return { ...game, outcome, reason, turn: '', draw_offer_by: '' };
}

export function requireUnfinished(game: MultiplayerGame): void {
  if (game.outcome !== 'ongoing')
    throw new MutationError('CHESS_GAME_OVER', 'The multiplayer game is over.');
}
