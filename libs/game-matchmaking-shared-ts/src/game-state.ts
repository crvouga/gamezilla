import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

export type MultiplayerOutcome =
  | 'ongoing'
  | 'white'
  | 'black'
  | 'red'
  | 'blue'
  | 'draw'
  | 'aborted';

export type MultiplayerGame = {
  readonly id: string;
  readonly white_id: string;
  readonly black_id: string;
  readonly red_id?: string | null;
  readonly blue_id?: string | null;
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
  readonly red_ms?: number | null;
  readonly blue_ms?: number | null;
  /** Server time the running clock (or the first-move wait) last started. */
  readonly clock_at_ms: number | null;
  /** A trusted shared pause; independent of every person's connection. */
  readonly paused_at_ms: number | null;
  readonly draw_offer_by: string | null;
  readonly rematch_offer_by: string | null;
  readonly draw_votes?: string | null;
  readonly rematch_votes?: string | null;
  readonly rematch_of: string | null;
  /** Each person's rating for the game's speed as shown when it started. */
  readonly white_rating: string | null;
  readonly black_rating: string | null;
  readonly red_rating?: string | null;
  readonly blue_rating?: string | null;
  readonly white_rating_diff: number | null;
  readonly black_rating_diff: number | null;
  readonly red_rating_diff?: number | null;
  readonly blue_rating_diff?: number | null;
  /**
   * For a game whose sides prepare private setups, the sides whose setup is
   * chosen (`''`, `'white'`, `'black'` or `'white,black'`); `null` for any
   * other game. Readiness is public; the setups themselves are not.
   */
  readonly setup_ready: string | null;
};

export const MULTIPLAYER_GAME_COLUMNS = [
  'id',
  'white_id',
  'black_id',
  'red_id',
  'blue_id',
  'fen',
  'pgn',
  'revision',
  'turn',
  'outcome',
  'reason',
  'time_control',
  'white_ms',
  'black_ms',
  'red_ms',
  'blue_ms',
  'clock_at_ms',
  'paused_at_ms',
  'draw_offer_by',
  'rematch_offer_by',
  'draw_votes',
  'rematch_votes',
  'rematch_of',
  'white_rating',
  'black_rating',
  'red_rating',
  'blue_rating',
  'white_rating_diff',
  'black_rating_diff',
  'red_rating_diff',
  'blue_rating_diff',
  'setup_ready',
] as const;

export type MultiplayerSide = GameSide;

/** The sides whose private setup is chosen. */
export function setupReadySides(
  game: Pick<MultiplayerGame, 'setup_ready'>
): readonly MultiplayerSide[] {
  return (game.setup_ready ?? '')
    .split(',')
    .filter((side): side is MultiplayerSide =>
      ['white', 'black', 'red', 'blue'].includes(side)
    );
}

/** Whether the game still waits for a side's private setup before its first move. */
export function awaitingSetups(
  game: Pick<MultiplayerGame, 'setup_ready' | 'outcome' | 'red_id' | 'blue_id'>
): boolean {
  return (
    game.outcome === 'ongoing' &&
    game.setup_ready !== null &&
    setupReadySides(game).length <
      2 + Number(Boolean(game.red_id)) + Number(Boolean(game.blue_id))
  );
}

/** Both people have made their first move: clocks run, aborting ends. */
export function bothHaveMoved(
  game: Pick<MultiplayerGame, 'revision' | 'red_id' | 'blue_id'>
): boolean {
  return (
    game.revision >=
    2 + Number(Boolean(game.red_id)) + Number(Boolean(game.blue_id))
  );
}

export function otherPerson(game: MultiplayerGame, ownerId: string): string {
  return game.white_id === ownerId ? game.black_id : game.white_id;
}

export function isFinished(outcome: MultiplayerOutcome): boolean {
  return outcome !== 'ongoing' && outcome !== 'aborted';
}

/** A game that ended keeps no offer and no side to move. */
export function endMultiplayerGame(
  game: MultiplayerGame,
  outcome: Exclude<MultiplayerOutcome, 'ongoing'>,
  reason: string
): MultiplayerGame {
  return {
    ...game,
    outcome,
    reason,
    turn: '',
    draw_offer_by: '',
    draw_votes: null,
  };
}

export function requireUnfinished(game: MultiplayerGame): void {
  if (game.outcome !== 'ongoing')
    throw new MutationError('CHESS_GAME_OVER', 'The multiplayer game is over.');
}
