import {
  type GameBots,
  type GameRules,
  gameSides,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGame } from './custom-game-state';

/**
 * Positions known to describe their action sequence, per rules: replayed
 * once, or reached by playing an accepted action from a known position. A
 * long game is then not replayed from its start before every move. Bounded:
 * the oldest entries are forgotten and simply replayed again.
 */
const VERIFIED = new WeakMap<GameRules, Set<string>>();
const VERIFIED_LIMIT = 256;

function retainedKey(game: Pick<CustomGame, 'fen' | 'moves'>): string {
  return JSON.stringify([game.fen, game.moves.map((move) => move.uci)]);
}

/** Remember that `game`'s position was reached by playing its actions under `played`. */
export function rememberCustomGamePosition(
  game: Pick<CustomGame, 'fen' | 'moves'>,
  played: GameRules
): void {
  const known = VERIFIED.get(played) ?? new Set<string>();
  VERIFIED.set(played, known);
  known.add(retainedKey(game));
  if (known.size > VERIFIED_LIMIT)
    known.delete(known.values().next().value as string);
}

/** A retained position must describe exactly the accepted action sequence. */
export function assertCustomGamePosition(
  game: CustomGame,
  rules: TurnGames
): void {
  const played = rules.forPosition(game.fen);
  const expected = gameSides(played);
  if (JSON.stringify(game.sides) !== JSON.stringify(expected))
    throw new Error('The retained game roster does not match its rules');
  if (VERIFIED.get(played)?.has(retainedKey(game)) === true) return;
  const actions = game.moves.map((move) => move.uci);
  if (played.replay(actions, actions.length) !== game.fen)
    throw new Error(
      'The retained game position does not match its action history'
    );
  rememberCustomGamePosition(game, played);
}
export function customGamePositionAt(
  game: CustomGame,
  ply: number,
  rules: TurnGames
): string | null {
  assertCustomGamePosition(game, rules);
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) return null;
  return rules.forPosition(game.fen).replay(
    game.moves.map((move) => move.uci),
    ply
  );
}
/** The bots of the custom game's own game. */
export function customGameBots(game: CustomGame, rules: TurnGames): GameBots {
  const customGames = rules.capability(
    rules.forPosition(game.fen).id,
    'custom-games'
  );
  if (customGames === undefined)
    throw new Error('The game offers no Custom Games');
  return customGames.bots;
}
/**
 * The bot's choice for the side to move, at its difficulty, given only
 * that side's own hand (for a game with dealt hands).
 */
export function customGameBotMove(
  game: CustomGame,
  rules: TurnGames,
  turn: { readonly random: () => number; readonly hand: string | null }
): string | null {
  return customGameBots(game, rules).choose(
    game.fen,
    game.difficulty[game.turn],
    turn.random,
    turn.hand
  );
}
export function customGameLegalMoves(
  game: CustomGame,
  rules: TurnGames
): readonly string[] {
  return game.status === 'active'
    ? rules.forPosition(game.fen).legal(game.fen)
    : [];
}
