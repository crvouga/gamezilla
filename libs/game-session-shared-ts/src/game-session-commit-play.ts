import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import { GameSessionsChanged } from './game-session-commands';
import {
  gameSessionCommitmentChosen,
  gameSessionCommitments,
} from './game-session-commitments';
import { gameSessionEffects } from './game-session-effects';
import {
  gameSessionHand,
  gameSessionHandEvents,
  gameSessionHidden,
} from './game-session-hands';
import { soloGameSession } from './game-session-local';
import { playGameSessionMove } from './game-session-play';
import { refuseGameSession } from './game-session-result';
import type { GameSession, GameSessionSide } from './game-session-state';
import { GameSessionsAttr, gameSessionPersonSide } from './game-session-state';

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
  readonly game: GameSession;
  readonly rules: TurnGames;
};

/** The game sessions after `current`: the commitment recorded first, hands after. */
function changed(
  decision: Decision,
  current: GameSession,
  recorded: readonly Message[]
): HandleResult {
  const [commitment, ...hands] = recorded;
  return {
    ok: true,
    events: [
      ...(commitment === undefined ? [] : [commitment]),
      GameSessionsChanged({
        games: { ...GameSessionsAttr.from(decision.state), current },
        commandId: decision.ctx.commandId,
        reason: '',
      }),
      ...hands,
    ],
    effects: gameSessionEffects(current, decision.rules),
  };
}

/** `side` commits; the room resolves the phase once every side has. */
export function commitGameSessionSide(
  decision: Decision,
  side: GameSessionSide,
  commitment: string
): HandleResult {
  const { game, ctx, rules, state } = decision;
  const hands = rules.turnsForPosition(game.fen)?.hands;
  const commit = hands?.commit;
  // The room holds every hand; a device only its own person's.
  const hand = gameSessionHand(state, game, side);
  if (hands === undefined || commit === undefined || hand === null)
    return refuseGameSession('nothing to choose now');
  if (!game.awaiting.includes(side))
    return refuseGameSession('nothing to choose now');
  const acceptance = commit.accept(game.fen, side, hand, commitment);
  if ('refusal' in acceptance) return refuseGameSession(acceptance.refusal);
  const accepted = acceptance.commitment;
  // The room decides; so does the creator's device in their solo practice,
  // which holds the hidden state and plays the bots offline too.
  const decides =
    ctx.authority ||
    (soloGameSession(game, rules) && gameSessionHidden(state, game) !== null);
  if (!decides) return { ok: true, events: [] };
  const recorded = gameSessionCommitmentChosen(game, side, accepted);
  const committed: GameSession = {
    ...game,
    awaiting: game.awaiting.filter((other) => other !== side),
    committed: game.sides.filter(
      (other) => other === side || game.committed.includes(other)
    ),
  };
  if (committed.awaiting.length > 0)
    return changed(decision, committed, [recorded]);
  const hidden = gameSessionHidden(state, game);
  if (hidden === null) throw new Error('the room holds the hidden state');
  const resolution = commit.resolve(
    game.fen,
    { ...gameSessionCommitments(state, game), [side]: accepted },
    hidden
  );
  const next = playGameSessionMove(committed, resolution.action, ctx.ts, rules);
  if (next === null)
    throw new Error(
      `${game.fen}: its commitments resolved to a refused action`
    );
  return changed(decision, next, [
    recorded,
    ...gameSessionHandEvents(state, game, {
      hidden: resolution.hidden,
      hands,
      all: false,
    }),
  ]);
}

/** A person's own commitment, or `null` when the choice is not one. */
export function commitmentChoice(
  decision: Decision,
  choice: GameSessionChoice
): HandleResult | null {
  if (choice.operation !== 'commit') return null;
  const side = gameSessionPersonSide(decision.game, decision.ctx.identity);
  return side === null
    ? refuseGameSession('not a participant')
    : commitGameSessionSide(decision, side, choice.commitment);
}
