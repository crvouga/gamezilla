import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import { configureGameSession } from './game-session-configuration';
import { soloGameSession } from './game-session-local';
import { gameSessionBots } from './game-session-position';
import type { GameSession } from './game-session-state';

/** Only an opted-in game offers two seats on one device; they never impersonate a member. */
export function configuredGameSession(
  game: GameSession,
  choice: GameSessionChoice,
  actor: string,
  rules: TurnGames
): { readonly game: GameSession; readonly reason: string } {
  const definition = rules.forPosition(game.fen);
  if (
    game.mode === 'vs-human' &&
    (choice.operation === 'bot' || choice.operation === 'difficulty')
  )
    return { game, reason: 'choose Play Bots to play against a bot' };
  if (
    game.mode === 'vs-bot' &&
    [
      'claim',
      'release',
      'invite',
      'accept',
      'decline',
      'revoke',
      'local',
      'open',
      'close',
      'take',
    ].includes(choice.operation)
  )
    return { game, reason: 'choose Play Friend to play with another person' };
  if (
    choice.operation === 'difficulty' &&
    !gameSessionBots(game, rules).difficulties.includes(choice.difficulty)
  )
    return { game, reason: 'difficulty not offered' };
  if (
    choice.operation === 'clock' &&
    rules.turnsForPosition(game.fen) === undefined
  )
    return { game, reason: 'choose the game score instead of a turn clock' };
  if (
    choice.operation === 'local' &&
    rules.capability(definition.id, 'vs-human')?.localPlayers !== true
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
  const configured = configureGameSession(game, choice, actor);
  if (
    [configured.white, configured.black].some(
      (side) => side.kind === 'local'
    ) &&
    !soloGameSession(configured, rules)
  )
    return {
      game,
      reason:
        'replace the player on this device before inviting another person',
    };
  return { game: configured, reason: '' };
}
