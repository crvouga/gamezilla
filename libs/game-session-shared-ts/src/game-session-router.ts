import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import { createMessageRouter } from '@pkgs/message-shared-ts/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { GameSessionAbsenceAttr } from './game-session-absence';
import { GameSessionAvailableAttr } from './game-session-availability';
import {
  ChangeGameSession,
  ChangeLocalGameSession,
  type ChangeLocalGameSessionPayload,
  EndGameSessionOnTime,
  EndLocalGameSessionOnTime,
  GameSessionAbsencePaused,
  GameSessionAvailabilityChanged,
  GameSessionProgressed,
  GameSessionsChanged,
  gameSessionCmdNs,
  gameSessionEvtNs,
  PlayGameSessionBot,
  StandInGameSession,
} from './game-session-commands';
import {
  GameSessionCommitmentChosen,
  GameSessionCommitmentsAttr,
  keptGameSessionCommitments,
  reduceGameSessionCommitment,
} from './game-session-commitments';
import {
  handleGameSessionChoice,
  handleGameSessionWake,
} from './game-session-handler';
import {
  GameSessionHandShown,
  GameSessionHandsAttr,
  GameSessionHiddenDealt,
  gameSessionHandsRules,
  gameSessionHidden,
  keptGameSessionHands,
  reduceGameSessionHand,
  reduceGameSessionHidden,
} from './game-session-hands';
import { localGameSessionChoiceAllowed } from './game-session-local';
import {
  compactGameSessionResult,
  progressedGameSessions,
} from './game-session-progress';
import { refuseGameSession } from './game-session-result';
import {
  GameSessionSetupChosen,
  GameSessionSetupsAttr,
  keptGameSessionSetups,
  reduceGameSessionSetup,
} from './game-session-setup';
import {
  handleGameSessionStandIn,
  withStandInEffects,
} from './game-session-stand-in';
import {
  EMPTY_GAME_SESSIONS,
  type GameSessions,
  GameSessionsAttr,
} from './game-session-state';

const noticeSchema = z
  .object({ commandId: z.string(), reason: z.string() })
  .strict();
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const GameSessionNoticeAttr = ns.json('notice', (v) =>
  v === undefined ? { commandId: '', reason: '' } : noticeSchema.parse(v)
);

/**
 * How every copy decides a solo choice: at the time the creator made it.
 * In a solo game with dealt hands every copy decides as the room — it
 * deals from the draws the creator's device made and resolves with the
 * hidden state its creator reads — so the device and the room agree.
 */
function soloChoiceContext(
  state: RoomState,
  ctx: GameCommandContext,
  payload: ChangeLocalGameSessionPayload,
  rules: TurnGames
): GameCommandContext {
  const at = { ...ctx, ts: Math.min(ctx.ts, payload.at) };
  const game = GameSessionsAttr.from(state).current;
  if (game === null || gameSessionHandsRules(game, rules) === undefined)
    return at;
  const draws = [...(payload.draws ?? [])];
  const dealt = gameSessionHidden(state, game) !== null;
  // A start without the creator's draws is the room's alone to deal.
  if (!dealt && payload.draws === undefined) return at;
  return {
    ...at,
    authority: true,
    random: () => draws.shift() ?? ctx.random(),
  };
}

/**
 * A command's result as the room records it: moves appended recorded as
 * just what they add, with the stand-in wake the result needs.
 */
/** Every game-session command, with the stand-in wake its result needs. */
export function createGameSessionCommandRouter(rules: TurnGames) {
  function settled(state: RoomState, result: HandleResult): HandleResult {
    // The stand-in wake reads the change before it is compacted.
    return compactGameSessionResult(
      state,
      withStandInEffects(state, result, rules)
    );
  }

  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    gameSessionCmdNs
  )
    .on(ChangeGameSession, (state, ctx, command) =>
      settled(
        state,
        handleGameSessionChoice(state, ctx, command.payload, rules)
      )
    )
    .on(ChangeLocalGameSession, (state, ctx, command) =>
      localGameSessionChoiceAllowed(
        GameSessionsAttr.from(state).current,
        command.payload.choice,
        rules
      )
        ? compactGameSessionResult(
            state,
            handleGameSessionChoice(
              state,
              soloChoiceContext(state, ctx, command.payload, rules),
              command.payload.choice,
              rules
            )
          )
        : refuseGameSession('connection needed')
    )
    .on(PlayGameSessionBot, (state, ctx, command) =>
      settled(
        state,
        handleGameSessionWake(
          state,
          ctx,
          { wake: command.payload, bot: true },
          rules
        )
      )
    )
    .on(EndLocalGameSessionOnTime, (state, ctx, command) =>
      compactGameSessionResult(
        state,
        handleGameSessionWake(
          state,
          ctx,
          { wake: command.payload, bot: false },
          rules
        )
      )
    )
    .on(EndGameSessionOnTime, (state, ctx, command) =>
      settled(
        state,
        handleGameSessionWake(
          state,
          ctx,
          { wake: command.payload, bot: false },
          rules
        )
      )
    )
    .on(StandInGameSession, (state, ctx, command) =>
      settled(
        state,
        handleGameSessionStandIn(state, ctx, command.payload, rules)
      )
    );
}

/**
 * The space holding `games` after a change answering `answer`'s command:
 * the private state of games no longer kept is let go.
 */
function withGameSessions(
  state: RoomState,
  games: GameSessions,
  answer: { readonly commandId: string; readonly reason: string }
): RoomState {
  return keptCommitmentsAndHands(
    keptGameSessionSetups(
      {
        ...state,
        ...GameSessionsAttr(games),
        ...GameSessionNoticeAttr({
          commandId: answer.commandId,
          reason: answer.reason,
        }),
      },
      games
    ),
    games
  );
}

/** The kept hands, then only the open phase's commitments. */
function keptCommitmentsAndHands(
  state: RoomState,
  games: Parameters<typeof keptGameSessionHands>[1]
): RoomState {
  return keptGameSessionCommitments(keptGameSessionHands(state, games), games);
}

export const gameSessionEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(gameSessionEvtNs)
  .on(GameSessionsChanged, (state, _ctx, event) =>
    withGameSessions(state, event.payload.games, event.payload)
  )
  .on(GameSessionProgressed, (state, _ctx, event) =>
    withGameSessions(
      state,
      progressedGameSessions(GameSessionsAttr.from(state), event.payload),
      event.payload
    )
  )
  .on(GameSessionSetupChosen, (state, _ctx, event) =>
    reduceGameSessionSetup(state, event.payload)
  )
  .on(GameSessionHiddenDealt, (state, _ctx, event) =>
    reduceGameSessionHidden(state, event.payload)
  )
  .on(GameSessionHandShown, (state, _ctx, event) =>
    reduceGameSessionHand(state, event.payload)
  )
  .on(GameSessionCommitmentChosen, (state, _ctx, event) =>
    reduceGameSessionCommitment(state, event.payload)
  )
  .on(GameSessionAvailabilityChanged, (state, _ctx, event) => ({
    ...state,
    ...GameSessionAvailableAttr(event.payload.available),
    ...GameSessionAbsenceAttr(event.payload.absence),
  }))
  .on(GameSessionAbsencePaused, (state, _ctx, event) => ({
    ...state,
    ...GameSessionAbsenceAttr(event.payload.absence),
  }));

export function gameSessionInitialAttrs(): RoomState {
  return {
    ...GameSessionsAttr(EMPTY_GAME_SESSIONS),
    ...GameSessionNoticeAttr({ commandId: '', reason: '' }),
    ...GameSessionSetupsAttr({}),
    ...GameSessionHandsAttr({}),
    ...GameSessionCommitmentsAttr({}),
  };
}
