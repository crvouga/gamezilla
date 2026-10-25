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
  customGamePersonSide,
  LOCAL_CUSTOM_GAME_SIDE,
  newCustomGame,
  OPEN_CUSTOM_GAME_SIDE,
  rotatedCustomGameSide,
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
    ? game.sides.filter((s) => s === side || game.ready.includes(s))
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
    case 'local':
      return replaceCustomGameSide(game, choice.side, LOCAL_CUSTOM_GAME_SIDE);
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
    case 'swap': {
      const rotated = { ...game, ready: [], revision: game.revision + 1 };
      for (const side of game.sides)
        rotated[side] = game[rotatedCustomGameSide(game, side)];
      return game.sides.every(
        (side) =>
          rotated[side].kind === game[side].kind &&
          rotated[side].person === game[side].person
      )
        ? game
        : rotated;
    }
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
    participant.kind === 'local' ||
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
  const next = newCustomGame(
    id,
    game.creator,
    rules.forPosition(game.fen).configuration?.restart(game.fen) ??
      rules.forPosition(game.fen).initial(),
    game.sides
  );
  for (const side of game.sides) {
    const previous = rotatedCustomGameSide(game, side);
    next[side] = inheritSide(game[previous], members);
    next.difficulty[side] = game.difficulty[previous];
  }
  return { ...next, minutes: game.minutes, increment: game.increment };
}
