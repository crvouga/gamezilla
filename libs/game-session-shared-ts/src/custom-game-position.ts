import {
  type GameBotChoices,
  gameSides,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import type { CustomGame } from './custom-game-state';
import { simulationCommandKey } from './simulation-command-state';
/** A retained position must describe exactly the accepted action sequence. */
export function assertCustomGamePosition(
  game: CustomGame,
  rules: TurnGames
): void {
  const expected = gameSides(rules.forPosition(game.fen));
  if (JSON.stringify(game.sides) !== JSON.stringify(expected))
    throw new Error('The retained game roster does not match its rules');
  const actions = game.moves.map((move) => move.uci);
  const turns = rules.turnsForPosition(game.fen);
  if (turns === undefined) {
    const simulation = rules.simulation(rules.forPosition(game.fen).id);
    if (simulation === undefined || simulation.codec.decode(game.fen) === null)
      throw new Error('The retained simulation position is invalid');
    return;
  }
  const replayed = turns.replay(actions, actions.length);
  const simulation = rules.simulation(turns.id);
  const matches =
    simulation?.commands === undefined
      ? replayed === game.fen
      : simulationCommandKey(simulation, replayed) ===
        simulationCommandKey(simulation, game.fen);
  if (!matches)
    throw new Error(
      'The retained game position does not match its action history'
    );
}
export function customGamePositionAt(
  game: CustomGame,
  ply: number,
  rules: TurnGames
): string | null {
  assertCustomGamePosition(game, rules);
  if (!Number.isInteger(ply) || ply < 0 || ply > game.moves.length) return null;
  const turns = rules.turnsForPosition(game.fen);
  if (turns === undefined) return ply === 0 ? game.fen : null;
  return turns.replay(
    game.moves.map((move) => move.uci),
    ply
  );
}
/** The bots of the custom game's own game. */
export function customGameBots(
  game: CustomGame,
  rules: TurnGames
): GameBotChoices {
  const customGames = rules.capability(
    rules.forPosition(game.fen).id,
    'custom-games'
  );
  if (customGames === undefined)
    throw new Error('The game offers no Custom Games');
  return customGames.bots;
}
/**
 * The bot's choice for the side to move, at its difficulty. Every device
 * that plays a due bot move (the host's and the room's scheduler) chooses
 * the same one, so none shows a move the room then replaces.
 */
export function customGameBotMove(
  game: CustomGame,
  rules: TurnGames
): string | null {
  const random = createSeededRng(`${game.id}:${game.moves.length}`).random;
  return (
    customGameBots(game, rules).choose?.(
      game.fen,
      game.difficulty[game.turn],
      random
    ) ?? null
  );
}
export function customGameLegalMoves(
  game: CustomGame,
  rules: TurnGames
): readonly string[] {
  return game.status === 'active'
    ? (rules.turnsForPosition(game.fen)?.legal(game.fen) ?? [])
    : [];
}
