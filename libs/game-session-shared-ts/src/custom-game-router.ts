import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import { createMessageRouter } from '@pkgs/message-shared-ts/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { CustomGameAbsenceAttr } from './custom-game-absence';
import { CustomGameAvailableAttr } from './custom-game-availability';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
  type ChangeLocalCustomGamePayload,
  CustomGameAvailabilityChanged,
  CustomGameProgressed,
  CustomGamesChanged,
  customGameCmdNs,
  customGameEvtNs,
  EndCustomGameOnTime,
  EndLocalCustomGameOnTime,
  PlayCustomGameBot,
  StandInCustomGame,
} from './custom-game-commands';
import {
  CustomGameCommitmentChosen,
  CustomGameCommitmentsAttr,
  keptCustomGameCommitments,
  reduceCustomGameCommitment,
} from './custom-game-commitments';
import {
  handleCustomGameChoice,
  handleCustomGameWake,
} from './custom-game-handler';
import {
  CustomGameHandShown,
  CustomGameHandsAttr,
  CustomGameHiddenDealt,
  customGameHandsRules,
  customGameHidden,
  keptCustomGameHands,
  reduceCustomGameHand,
  reduceCustomGameHidden,
} from './custom-game-hands';
import { localCustomGameChoiceAllowed } from './custom-game-local';
import { refuseCustomGame } from './custom-game-result';
import {
  CustomGameSetupChosen,
  CustomGameSetupsAttr,
  keptCustomGameSetups,
  reduceCustomGameSetup,
} from './custom-game-setup';
import {
  handleCustomGameStandIn,
  withStandInEffects,
} from './custom-game-stand-in';
import {
  type CustomGames,
  CustomGamesAttr,
  EMPTY_CUSTOM_GAMES,
} from './custom-game-state';
import {
  compactCustomGameResult,
  progressedCustomGames,
} from './custom-game-progress';

const noticeSchema = z
  .object({ commandId: z.string(), reason: z.string() })
  .strict();
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const CustomGameNoticeAttr = ns.json('notice', (v) =>
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
  payload: ChangeLocalCustomGamePayload,
  rules: TurnGames
): GameCommandContext {
  const at = { ...ctx, ts: Math.min(ctx.ts, payload.at) };
  const game = CustomGamesAttr.from(state).current;
  if (game === null || customGameHandsRules(game, rules) === undefined)
    return at;
  const draws = [...(payload.draws ?? [])];
  const dealt = customGameHidden(state, game) !== null;
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
function settled(state: RoomState, result: HandleResult): HandleResult {
  // The stand-in wake reads the change before it is compacted.
  return compactCustomGameResult(state, withStandInEffects(state, result));
}

/** Every custom-game command, with the stand-in wake its result needs. */
export function createCustomGameCommandRouter(rules: TurnGames) {
  return createMessageRouter<RoomState, GameCommandContext, HandleResult>(
    customGameCmdNs
  )
    .on(ChangeCustomGame, (state, ctx, command) =>
      settled(
        state,
        handleCustomGameChoice(state, ctx, command.payload, rules)
      )
    )
    .on(ChangeLocalCustomGame, (state, ctx, command) =>
      localCustomGameChoiceAllowed(
        CustomGamesAttr.from(state).current,
        command.payload.choice,
        rules
      )
        ? compactCustomGameResult(
            state,
            handleCustomGameChoice(
              state,
              soloChoiceContext(state, ctx, command.payload, rules),
              command.payload.choice,
              rules
            )
          )
        : refuseCustomGame('connection needed')
    )
    .on(PlayCustomGameBot, (state, ctx, command) =>
      settled(
        state,
        handleCustomGameWake(
          state,
          ctx,
          { wake: command.payload, bot: true },
          rules
        )
      )
    )
    .on(EndLocalCustomGameOnTime, (state, ctx, command) =>
      compactCustomGameResult(
        state,
        handleCustomGameWake(
          state,
          ctx,
          { wake: command.payload, bot: false },
          rules
        )
      )
    )
    .on(EndCustomGameOnTime, (state, ctx, command) =>
      settled(
        state,
        handleCustomGameWake(
          state,
          ctx,
          { wake: command.payload, bot: false },
          rules
        )
      )
    )
    .on(StandInCustomGame, (state, ctx, command) =>
      settled(
        state,
        handleCustomGameStandIn(state, ctx, command.payload, rules)
      )
    );
}

/**
 * The space holding `games` after a change answering `answer`'s command:
 * the private state of games no longer kept is let go.
 */
function withCustomGames(
  state: RoomState,
  games: CustomGames,
  answer: { readonly commandId: string; readonly reason: string }
): RoomState {
  return keptCommitmentsAndHands(
    keptCustomGameSetups(
      {
        ...state,
        ...CustomGamesAttr(games),
        ...CustomGameNoticeAttr({
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
  games: Parameters<typeof keptCustomGameHands>[1]
): RoomState {
  return keptCustomGameCommitments(keptCustomGameHands(state, games), games);
}

export const customGameEventReducer = createMessageRouter<
  RoomState,
  void,
  RoomState
>(customGameEvtNs)
  .on(CustomGamesChanged, (state, _ctx, event) =>
    withCustomGames(state, event.payload.games, event.payload)
  )
  .on(CustomGameProgressed, (state, _ctx, event) =>
    withCustomGames(
      state,
      progressedCustomGames(CustomGamesAttr.from(state), event.payload),
      event.payload
    )
  )
  .on(CustomGameSetupChosen, (state, _ctx, event) =>
    reduceCustomGameSetup(state, event.payload)
  )
  .on(CustomGameHiddenDealt, (state, _ctx, event) =>
    reduceCustomGameHidden(state, event.payload)
  )
  .on(CustomGameHandShown, (state, _ctx, event) =>
    reduceCustomGameHand(state, event.payload)
  )
  .on(CustomGameCommitmentChosen, (state, _ctx, event) =>
    reduceCustomGameCommitment(state, event.payload)
  )
  .on(CustomGameAvailabilityChanged, (state, _ctx, event) => ({
    ...state,
    ...CustomGameAvailableAttr(event.payload.available),
    ...CustomGameAbsenceAttr(event.payload.absence),
  }));

export function customGameInitialAttrs(): RoomState {
  return {
    ...CustomGamesAttr(EMPTY_CUSTOM_GAMES),
    ...CustomGameNoticeAttr({ commandId: '', reason: '' }),
    ...CustomGameSetupsAttr({}),
    ...CustomGameHandsAttr({}),
    ...CustomGameCommitmentsAttr({}),
  };
}
