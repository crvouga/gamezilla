import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import {
  spaceMembersRestricted,
  spaceSeatMemberIds,
} from '@libs/spaces-shared-ts/space-members-messages';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import {
  gameSides,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSessionAwaySince } from './game-session-absence';
import { GameSessionAvailableAttr } from './game-session-availability';
import type { GameSessionChoice } from './game-session-choice';
import type {
  GameSessionBotWake,
  GameSessionWake,
} from './game-session-commands';
import {
  commitGameSessionSide,
  commitmentChoice,
} from './game-session-commit-play';
import { rematchGameSession } from './game-session-configuration';
import {
  dealtHandsChoice,
  decideGameSessionMove,
} from './game-session-hand-play';
import {
  gameSessionHand,
  gameSessionHandsRules,
  gameSessionHidden,
} from './game-session-hands';
import { soloGameSession } from './game-session-local';
import { configuredGameSession } from './game-session-options';
import {
  expireGameSession,
  playGameSessionChoice,
  playGameSessionMove,
} from './game-session-play';
import { gameSessionBotMove, gameSessionBots } from './game-session-position';
import { privateSetupChoice } from './game-session-private-play';
import { gameSessionRefusal } from './game-session-refusal';
import { changedGameSessions, refuseGameSession } from './game-session-result';
import type { GameSession } from './game-session-state';
import {
  GameSessionsAttr,
  gameSessionBotPlays,
  newGameSession,
} from './game-session-state';

/** The game a new game session is of: the one asked for, else the space's. */
function gameForChoice(state: RoomState, choice: GameSessionChoice): string {
  const explicit = choice.operation === 'create' ? choice.game : undefined;
  return explicit ?? GamesRoomAttr.selected.from(state) ?? '';
}

/** A rematch of the current game, or a new one of a game offering Game Sessions. */
function createdGameSession(
  state: RoomState,
  ctx: GameCommandContext,
  choice: GameSessionChoice,
  context: {
    readonly game: GameSession | null;
    readonly members: readonly string[];
    readonly rules: TurnGames;
  }
): GameSession | null {
  const { game, members, rules } = context;
  const id =
    choice.operation === 'rematch' && game !== null
      ? rules.forPosition(game.fen).id
      : gameForChoice(state, choice);
  // A game no longer offering game sessions is refused, rematches included.
  const mode =
    choice.operation === 'create' ? (choice.mode ?? 'vs-human') : game?.mode;
  if (mode === undefined || !rules.offers(id, mode)) return null;
  if (choice.operation === 'rematch' && game !== null)
    return rematchGameSession(game, ctx.commandId, members, rules);
  const simulation = rules.simulation(id);
  const position =
    simulation === undefined
      ? rules.byId(id).initial()
      : simulation.codec.encode(simulation.initialize(ctx.commandId));
  return newGameSession({
    id: ctx.commandId,
    creator: ctx.identity,
    position,
    sides: gameSides(rules.byId(id)),
    mode,
  });
}

export function handleGameSessionChoice(
  state: RoomState,
  ctx: GameCommandContext,
  choice: GameSessionChoice,
  rules: TurnGames
): HandleResult {
  const games = GameSessionsAttr.from(state);
  const members = spaceSeatMemberIds(state);
  // Domain membership also removes the authority of a connection admitted
  // before a departure. Capability grants are checked at the room boundary.
  if (!members.includes(ctx.identity))
    return refuseGameSession('not in the space');
  const game = games.current;
  if (
    !GameSessionAvailableAttr.from(state) &&
    (game === null || !soloGameSession(game, rules))
  )
    return refuseGameSession('the Game Session is temporarily unavailable');
  const expired = game === null ? null : expireGameSession(game, ctx.ts, rules);
  if (expired !== game)
    return changedGameSessions({ ...games, current: expired }, ctx, rules, {
      reason: 'finished',
    });
  const reason = gameSessionRefusal(game, choice, ctx.identity, {
    members,
    restricted: (a, b) => spaceMembersRestricted(state, a, b),
    awaySince: (person) => gameSessionAwaySince(state, person),
    now: ctx.ts,
  });
  if (reason !== '') return refuseGameSession(reason);
  if (choice.operation === 'create' || choice.operation === 'rematch') {
    const created = createdGameSession(state, ctx, choice, {
      game,
      members,
      rules,
    });
    if (created === null)
      return refuseGameSession('the game offers no Game Sessions');
    return changedGameSessions(
      {
        current: created,
        history: game === null ? games.history : [...games.history, game],
      },
      ctx,
      rules
    );
  }
  if (game === null) return refuseGameSession('no Game Session');
  const decision = { state, ctx, game, rules };
  const privately =
    privateSetupChoice(decision, choice) ??
    commitmentChoice(decision, choice) ??
    dealtHandsChoice(decision, choice);
  if (privately !== null) return privately;
  const configured = configuredGameSession(game, choice, ctx.identity, rules);
  if (configured.reason !== '') return refuseGameSession(configured.reason);
  const next = playGameSessionChoice(
    configured.game,
    choice,
    { actor: ctx.identity, now: ctx.ts },
    rules
  );
  return next === null
    ? refuseGameSession('move is illegal')
    : changedGameSessions({ ...games, current: next }, ctx, rules);
}

function currentWake(
  game: GameSession | null,
  wake: GameSessionWake
): game is GameSession {
  return (
    game !== null &&
    game.status === 'active' &&
    game.id === wake.gameId &&
    game.moves.length === wake.ply &&
    (game.awaiting.length > 0
      ? game.awaiting.includes(wake.side)
      : game.turn === wake.side)
  );
}

/**
 * Whether someone other than the room chooses a move only the room may
 * choose: a stand-in's move for an away person's side, or a bot's whose hand
 * is the room's alone (every game with dealt hands but its creator's solo
 * practice). The creator's device predicts only its own bots' public moves.
 */
function choosesRoomBotMove(
  game: GameSession | null,
  ctx: GameCommandContext,
  wake: GameSessionBotWake | GameSessionWake,
  rules: TurnGames
): boolean {
  if (ctx.identity === ROOM_SCHEDULER_IDENTITY || !('move' in wake))
    return false;
  if (game === null) return false;
  if (game.standIns.includes(wake.side)) return true;
  return (
    gameSessionHandsRules(game, rules) !== undefined &&
    !soloGameSession(game, rules)
  );
}

/** Whether this copy cannot decide for the game's hands: it holds no hidden state. */
function lacksHiddenState(
  state: RoomState,
  ctx: GameCommandContext,
  game: GameSession,
  rules: TurnGames
): boolean {
  return (
    !ctx.authority &&
    gameSessionHandsRules(game, rules) !== undefined &&
    gameSessionHidden(state, game) === null
  );
}

/** The bot or stand-in playing `side` commits with that side's own hand alone. */
function botCommitment(
  state: RoomState,
  ctx: GameCommandContext,
  game: GameSession,
  rules: TurnGames
): (side: GameSession['turn']) => HandleResult {
  return (side) => {
    const commitment =
      gameSessionBots(game, rules).choose?.(
        game.fen,
        game.difficulty[side],
        ctx.random,
        gameSessionHand(state, game, side)
      ) ?? null;
    if (commitment === null)
      throw new Error('a committing bot has no commitment');
    return commitGameSessionSide({ state, ctx, game, rules }, side, commitment);
  };
}

type BotWakeDecision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: GameSession;
  readonly rules: TurnGames;
};

/** The bot's own choice on its wake: a commitment, or a move the room resolves. */
function playBotWake(
  decision: BotWakeDecision,
  wake: GameSessionBotWake | GameSessionWake,
  at: number
): HandleResult {
  const { state, ctx, game, rules } = decision;
  // A copy without the hidden state leaves the bot's turn to the room.
  if (lacksHiddenState(state, ctx, game, rules))
    return { ok: true, events: [] };
  if (game.awaiting.length > 0)
    return 'move' in wake
      ? commitGameSessionSide({ state, ctx, game, rules }, wake.side, wake.move)
      : botCommitment(state, ctx, game, rules)(wake.side);
  const move =
    'move' in wake
      ? wake.move
      : gameSessionBotMove(game, rules, {
          random: ctx.random,
          hand: gameSessionHand(state, game, game.turn),
        });
  if (move === null) throw new Error('active bot game has no legal move');
  // A bot proposes from the public position and its own hand; the room
  // alone resolves it.
  const decided = decideGameSessionMove(state, game, move, rules);
  if ('refusal' in decided) return refuseGameSession(decided.refusal);
  const next = playGameSessionMove(game, decided.action, at, rules);
  if (next === null) return refuseGameSession('move is illegal');
  return changedGameSessions(
    { ...GameSessionsAttr.from(state), current: next },
    ctx,
    rules,
    {
      privately: decided.privately,
    }
  );
}

export function handleGameSessionWake(
  state: RoomState,
  ctx: GameCommandContext,
  action: {
    wake: GameSessionBotWake | (GameSessionWake & { at: number });
    bot: boolean;
  },
  rules: TurnGames
): HandleResult {
  const { wake, bot } = action;
  const games = GameSessionsAttr.from(state);
  const game = games.current;
  if (
    ctx.identity !== ROOM_SCHEDULER_IDENTITY &&
    !(
      game?.creator === ctx.identity &&
      'at' in wake &&
      (bot || soloGameSession(game, rules))
    )
  )
    return refuseGameSession('only the game may move a bot or end a clock');
  if (choosesRoomBotMove(game, ctx, wake, rules))
    return refuseGameSession('only the game may move a bot or end a clock');
  if (!GameSessionAvailableAttr.from(state) && !soloGameSession(game, rules))
    return changedGameSessions(games, ctx, rules);
  if (!currentWake(game, wake)) return changedGameSessions(games, ctx, rules);
  const at = 'at' in wake ? Math.min(ctx.ts, wake.at) : ctx.ts;
  if (game.turnStartedAt !== null && at < game.turnStartedAt)
    return refuseGameSession('choices changed');
  const expired = expireGameSession(game, at, rules);
  if (expired !== game)
    return changedGameSessions({ ...games, current: expired }, ctx, rules);
  if (!bot || !gameSessionBotPlays(game, wake.side))
    return changedGameSessions(games, ctx, rules);
  return playBotWake({ state, ctx, game, rules }, wake, at);
}
