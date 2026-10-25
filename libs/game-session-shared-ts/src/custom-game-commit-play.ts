import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { CustomGamesChanged } from './custom-game-commands';
import {
  customGameCommitmentChosen,
  customGameCommitments,
} from './custom-game-commitments';
import { customGameEffects } from './custom-game-effects';
import {
  customGameHand,
  customGameHandEvents,
  customGameHidden,
} from './custom-game-hands';
import { playCustomGameMove } from './custom-game-play';
import { refuseCustomGame } from './custom-game-result';
import type { CustomGame, CustomGameSide } from './custom-game-state';
import { CustomGamesAttr, customGamePersonSide } from './custom-game-state';

/**
 * Private commitments: while every named side commits (passing three
 * cards), each commits once, from its own hand, recorded for its person
 * alone; the public game shows only who has committed. The commitment that
 * completes the phase resolves all of them at once, in the same room
 * command, into one public action and every hand after it — so no
 * commitment is ever a public turn, and a device predicts nothing.
 */

type Decision = {
  readonly state: RoomState;
  readonly ctx: GameCommandContext;
  readonly game: CustomGame;
  readonly rules: TurnGames;
};

/** The custom games after `current`: the commitment recorded first, hands after. */
function changed(
  decision: Decision,
  current: CustomGame,
  recorded: readonly Message[]
): HandleResult {
  const [commitment, ...hands] = recorded;
  return {
    ok: true,
    events: [
      ...(commitment === undefined ? [] : [commitment]),
      CustomGamesChanged({
        games: { ...CustomGamesAttr.from(decision.state), current },
        commandId: decision.ctx.commandId,
        reason: '',
      }),
      ...hands,
    ],
    effects: customGameEffects(current, decision.rules),
  };
}

/** `side` commits; the room resolves the phase once every side has. */
export function commitCustomGameSide(
  decision: Decision,
  side: CustomGameSide,
  commitment: string
): HandleResult {
  const { game, ctx, rules, state } = decision;
  const hands = rules.forPosition(game.fen).hands;
  const commit = hands?.commit;
  // The room holds every hand; a device only its own person's.
  const hand = customGameHand(state, game, side);
  if (hands === undefined || commit === undefined || hand === null)
    return refuseCustomGame('nothing to choose now');
  if (!game.awaiting.includes(side))
    return refuseCustomGame('nothing to choose now');
  const accepted = commit.accept(game.fen, side, hand, commitment);
  if (accepted === null) return refuseCustomGame('move is illegal');
  if (!ctx.authority) return { ok: true, events: [] };
  const recorded = customGameCommitmentChosen(game, side, accepted);
  const committed: CustomGame = {
    ...game,
    awaiting: game.awaiting.filter((other) => other !== side),
    committed: game.sides.filter(
      (other) => other === side || game.committed.includes(other)
    ),
  };
  if (committed.awaiting.length > 0)
    return changed(decision, committed, [recorded]);
  const hidden = customGameHidden(state, game);
  if (hidden === null) throw new Error('the room holds the hidden state');
  const resolution = commit.resolve(
    game.fen,
    { ...customGameCommitments(state, game), [side]: accepted },
    hidden
  );
  const next = playCustomGameMove(committed, resolution.action, ctx.ts, rules);
  if (next === null)
    throw new Error(`${game.fen}: its commitments resolved to a refused action`);
  return changed(decision, next, [
    recorded,
    ...customGameHandEvents(state, game, {
      hidden: resolution.hidden,
      hands,
      all: false,
    }),
  ]);
}

/** A person's own commitment, or `null` when the choice is not one. */
export function commitmentChoice(
  decision: Decision,
  choice: CustomGameChoice
): HandleResult | null {
  if (choice.operation !== 'commit') return null;
  const side = customGamePersonSide(decision.game, decision.ctx.identity);
  return side === null
    ? refuseCustomGame('not a participant')
    : commitCustomGameSide(decision, side, choice.commitment);
}
