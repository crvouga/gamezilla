import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import type {
  CustomGame,
  CustomGameParticipant,
  CustomGameSide,
} from './custom-game-state';
import {
  BOT_CUSTOM_GAME_SIDE,
  CLOSED_CUSTOM_GAME_SIDE,
  CUSTOM_GAME_SIDES,
  customGamePersonSide,
  newCustomGame,
  OPEN_CUSTOM_GAME_SIDE,
} from './custom-game-state';

export function replaceCustomGameSide(
  game: CustomGame,
  side: CustomGameSide,
  participant: CustomGameParticipant
): CustomGame {
  if (
    game[side].kind === participant.kind &&
    game[side].person === participant.person
  )
    return game;
  return {
    ...game,
    [side]: participant,
    ready: [],
    revision: game.revision + 1,
  };
}

function setCustomGameClock(
  game: CustomGame,
  minutes: number,
  increment: number
): CustomGame {
  return game.minutes === minutes && game.increment === increment
    ? game
    : { ...game, minutes, increment, ready: [], revision: game.revision + 1 };
}

function setCustomGameReady(
  game: CustomGame,
  actor: string,
  ready: boolean
): CustomGame {
  const side = customGamePersonSide(game, actor);
  if (side === null) return game;
  const next = ready
    ? CUSTOM_GAME_SIDES.filter((s) => s === side || game.ready.includes(s))
    : game.ready.filter((s) => s !== side);
  return { ...game, ready: next };
}

export function configureCustomGame(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string
): CustomGame {
  switch (choice.operation) {
    case 'difficulty':
      return {
        ...game,
        difficulty: { ...game.difficulty, [choice.side]: choice.difficulty },
        ready: [],
        revision: game.revision + 1,
      };
    case 'take':
    case 'accept':
    case 'claim':
      return replaceCustomGameSide(game, choice.side, {
        kind: 'person',
        person: actor,
      });
    case 'bot':
      return replaceCustomGameSide(game, choice.side, BOT_CUSTOM_GAME_SIDE);
    case 'open':
    case 'revoke':
    case 'decline':
    case 'release':
      return replaceCustomGameSide(game, choice.side, OPEN_CUSTOM_GAME_SIDE);
    case 'close':
      return replaceCustomGameSide(game, choice.side, CLOSED_CUSTOM_GAME_SIDE);
    case 'invite':
      return replaceCustomGameSide(game, choice.side, {
        kind: 'invitation',
        person: choice.person,
      });
    case 'ready':
      return setCustomGameReady(game, actor, true);
    case 'unready':
      return setCustomGameReady(game, actor, false);
    case 'swap':
      return game.white.kind === game.black.kind &&
        game.white.person === game.black.person
        ? game
        : {
            ...game,
            white: game.black,
            black: game.white,
            ready: [],
            revision: game.revision + 1,
          };
    case 'clock':
      return setCustomGameClock(game, choice.minutes, choice.increment);
    case 'untimed':
      return setCustomGameClock(game, 0, 0);
    default:
      return game;
  }
}

function inheritSide(
  participant: CustomGameParticipant,
  members: readonly string[]
): CustomGameParticipant {
  return participant.kind === 'bot' ||
    (participant.kind === 'person' && members.includes(participant.person))
    ? participant
    : OPEN_CUSTOM_GAME_SIDE;
}

export function rematchCustomGame(
  game: CustomGame,
  id: string,
  members: readonly string[],
  rules: TurnGames
): CustomGame {
  return {
    ...newCustomGame(id, game.creator, rules.forPosition(game.fen).initial()),
    white: inheritSide(game.black, members),
    black: inheritSide(game.white, members),
    difficulty: { white: game.difficulty.black, black: game.difficulty.white },
    minutes: game.minutes,
    increment: game.increment,
  };
}
