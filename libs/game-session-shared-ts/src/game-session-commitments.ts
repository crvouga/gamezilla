import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { createAttrNamespace } from '@pkgs/attribute-shared-ts/attribute';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { GameCommitments } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { gameSessionEvtNs } from './game-session-commands';
import { creatorAloneInGameSession } from './game-session-solo';
import type {
  GameSession,
  GameSessionSide,
  GameSessions,
} from './game-session-state';
import {
  GAME_SESSION_SIDES,
  gameSessionPersonSide,
} from './game-session-state';

/**
 * The private commitments of a space's game sessions. While every side
 * commits (passing three cards), each commitment is recorded as an event only
 * its person reads (a bot's, nobody): the room holds every commitment of the
 * phase, a device only its own person's, and the game session itself, which
 * everyone in the space sees, shows only which sides have committed. A
 * phase's commitments are forgotten once it is resolved.
 */

const commitmentSchema = z.string().min(1).max(256);
const commitmentChosenSchema = z
  .object({
    gameId: z.string().min(1),
    side: z.enum(GAME_SESSION_SIDES),
    /** The person the commitment is private to; empty for a bot's. */
    person: z.string(),
    /** Who else reads a bot's commitment: the creator of a solo practice game. */
    reader: z.string().max(256).optional(),
    /** The ply at which the phase of commitments opened. */
    ply: z.number().int().nonnegative(),
    commitment: commitmentSchema,
  })
  .strict();
export type GameSessionCommitmentChosenPayload = z.infer<
  typeof commitmentChosenSchema
>;
export const GameSessionCommitmentChosen = gameSessionEvtNs(
  'commitment-chosen',
  (p): p is GameSessionCommitmentChosenPayload =>
    commitmentChosenSchema.safeParse(p).success
);

const commitmentsSchema = z.record(
  z.string(),
  z
    .object({
      ply: z.number().int().nonnegative(),
      sides: z
        .object({
          white: commitmentSchema,
          black: commitmentSchema,
          red: commitmentSchema,
          blue: commitmentSchema,
        })
        .partial()
        .strict(),
    })
    .strict()
);
type GameSessionCommitments = z.infer<typeof commitmentsSchema>;
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const GameSessionCommitmentsAttr = ns.json(
  'commitments',
  (v): GameSessionCommitments =>
    v === undefined ? {} : commitmentsSchema.parse(v)
);

/** A commitment is read only by its person (a bot's by nobody). */
export function gameSessionCommitmentAudience(
  event: Message
): readonly string[] | null {
  if (!GameSessionCommitmentChosen.is(event)) return null;
  if (event.payload.person !== '') return [event.payload.person];
  return event.payload.reader === undefined ? [] : [event.payload.reader];
}

/** A commitment joins its phase's; an earlier phase's are forgotten. */
export function reduceGameSessionCommitment(
  state: RoomState,
  event: GameSessionCommitmentChosenPayload
): RoomState {
  const commitments = GameSessionCommitmentsAttr.from(state);
  const phase = commitments[event.gameId];
  const sides = phase?.ply === event.ply ? phase.sides : {};
  return {
    ...state,
    ...GameSessionCommitmentsAttr({
      ...commitments,
      [event.gameId]: {
        ply: event.ply,
        sides: { ...sides, [event.side]: event.commitment },
      },
    }),
  };
}

/** Only the open phase of the current game keeps its commitments. */
export function keptGameSessionCommitments(
  state: RoomState,
  games: GameSessions
): RoomState {
  const commitments = GameSessionCommitmentsAttr.from(state);
  const current = games.current;
  const phase = current === null ? undefined : commitments[current.id];
  const kept =
    current !== null &&
    phase !== undefined &&
    phase.ply === current.moves.length &&
    current.committed.length > 0
      ? { [current.id]: phase }
      : {};
  return Object.keys(commitments).length === Object.keys(kept).length
    ? state
    : { ...state, ...GameSessionCommitmentsAttr(kept) };
}

/** The open phase's commitments this copy of the space holds. */
export function gameSessionCommitments(
  state: RoomState,
  game: GameSession
): GameCommitments {
  const phase = GameSessionCommitmentsAttr.from(state)[game.id];
  if (phase === undefined || phase.ply !== game.moves.length) return {};
  return Object.fromEntries(
    game.committed.flatMap((side) =>
      phase.sides[side] === undefined ? [] : [[side, phase.sides[side]]]
    )
  );
}

/** `person`'s own commitment in the open phase, as their copy holds it. */
export function ownGameSessionCommitment(
  state: RoomState,
  game: GameSession,
  person: string
): string | null {
  const side = gameSessionPersonSide(game, person);
  if (side === null) return null;
  return gameSessionCommitments(state, game)[side] ?? null;
}

export function gameSessionCommitmentChosen(
  game: GameSession,
  side: GameSessionSide,
  commitment: string
): Message {
  const person = game[side].kind === 'person' ? game[side].person : '';
  // In the creator's solo practice their device decides as the room does,
  // so it reads the bots' commitments too; with anyone else, nobody does.
  const reader =
    person === '' && creatorAloneInGameSession(game)
      ? { reader: game.creator }
      : {};
  return GameSessionCommitmentChosen({
    gameId: game.id,
    side,
    person,
    ...reader,
    ply: game.moves.length,
    commitment,
  });
}
