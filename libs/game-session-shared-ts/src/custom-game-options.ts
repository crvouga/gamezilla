import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { configureCustomGame } from './custom-game-configuration';
import { soloCustomGame } from './custom-game-local';
import type { CustomGame } from './custom-game-state';

/** Only an opted-in game offers two seats on one device; they never impersonate a member. */
export function configuredCustomGame(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string,
  rules: TurnGames
): { readonly game: CustomGame; readonly reason: string } {
  const definition = rules.forPosition(game.fen);
  if (
    choice.operation === 'clock' &&
    rules.turnsForPosition(game.fen) === undefined
  )
    return { game, reason: 'choose the game score instead of a turn clock' };
  if (
    choice.operation === 'local' &&
    rules.capability(definition.id, 'custom-games')?.localPlayers !== true
  )
    return {
      game,
      reason: 'this game does not offer two players on one device',
    };
  if (choice.operation === 'rules') {
    const position = definition.configuration?.apply(game.fen, choice.choice);
    return position == null
      ? { game, reason: 'invalid game options; choose an offered value' }
      : {
          game: {
            ...game,
            fen: position,
            ready: [],
            revision: game.revision + 1,
          },
          reason: '',
        };
  }
  const configured = configureCustomGame(game, choice, actor);
  if (
    [configured.white, configured.black].some(
      (side) => side.kind === 'local'
    ) &&
    !soloCustomGame(configured, rules)
  )
    return {
      game,
      reason:
        'replace the player on this device before inviting another person',
    };
  return { game: configured, reason: '' };
}
