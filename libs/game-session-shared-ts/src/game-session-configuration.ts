import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import type {
  GameSession,
  GameSessionParticipant,
  GameSessionSide,
} from './game-session-state';
import {
  BOT_GAME_SESSION_SIDE,
  CLOSED_GAME_SESSION_SIDE,
  gameSessionPersonSide,
  LOCAL_GAME_SESSION_SIDE,
  newGameSession,
  OPEN_GAME_SESSION_SIDE,
  rotatedGameSessionSide,
} from './game-session-state';

export function replaceGameSessionSide(
  game: GameSession,
  side: GameSessionSide,
  participant: GameSessionParticipant
): GameSession {
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

function setGameSessionClock(
  game: GameSession,
  minutes: number,
  increment: number
): GameSession {
  return game.minutes === minutes && game.increment === increment
    ? game
    : { ...game, minutes, increment, ready: [], revision: game.revision + 1 };
}

function setGameSessionReady(
  game: GameSession,
  actor: string,
  ready: boolean
): GameSession {
  const side = gameSessionPersonSide(game, actor);
  if (side === null) return game;
  const next = ready
    ? game.sides.filter((s) => s === side || game.ready.includes(s))
    : game.ready.filter((s) => s !== side);
  return { ...game, ready: next };
}

export function configureGameSession(
  game: GameSession,
  choice: GameSessionChoice,
  actor: string
): GameSession {
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
      return replaceGameSessionSide(game, choice.side, {
        kind: 'person',
        person: actor,
      });
    case 'bot':
      return replaceGameSessionSide(game, choice.side, BOT_GAME_SESSION_SIDE);
    case 'local':
      return replaceGameSessionSide(game, choice.side, LOCAL_GAME_SESSION_SIDE);
    case 'open':
    case 'revoke':
    case 'decline':
    case 'release':
      return replaceGameSessionSide(game, choice.side, OPEN_GAME_SESSION_SIDE);
    case 'close':
      return replaceGameSessionSide(
        game,
        choice.side,
        CLOSED_GAME_SESSION_SIDE
      );
    case 'invite':
      return replaceGameSessionSide(game, choice.side, {
        kind: 'invitation',
        person: choice.person,
      });
    case 'ready':
      return setGameSessionReady(game, actor, true);
    case 'unready':
      return setGameSessionReady(game, actor, false);
    case 'swap': {
      const rotated = { ...game, ready: [], revision: game.revision + 1 };
      for (const side of game.sides)
        rotated[side] = game[rotatedGameSessionSide(game, side)];
      return game.sides.every(
        (side) =>
          rotated[side].kind === game[side].kind &&
          rotated[side].person === game[side].person
      )
        ? game
        : rotated;
    }
    case 'clock':
      return setGameSessionClock(game, choice.minutes, choice.increment);
    case 'untimed':
      return setGameSessionClock(game, 0, 0);
    default:
      return game;
  }
}

function inheritSide(
  participant: GameSessionParticipant,
  members: readonly string[]
): GameSessionParticipant {
  return participant.kind === 'bot' ||
    participant.kind === 'local' ||
    (participant.kind === 'person' && members.includes(participant.person))
    ? participant
    : OPEN_GAME_SESSION_SIDE;
}

export function rematchGameSession(
  game: GameSession,
  id: string,
  members: readonly string[],
  rules: TurnGames
): GameSession {
  const position = rules.forPosition(game.fen);
  const next = newGameSession({
    id,
    creator: game.creator,
    position: position.configuration?.restart(game.fen) ?? position.initial(),
    sides: game.sides,
    mode: game.mode,
  });
  for (const side of game.sides) {
    const previous = rotatedGameSessionSide(game, side);
    next[side] = inheritSide(game[previous], members);
    next.difficulty[side] = game.difficulty[previous];
  }
  return { ...next, minutes: game.minutes, increment: game.increment };
}
