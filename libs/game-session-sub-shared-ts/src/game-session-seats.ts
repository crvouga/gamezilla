import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import type {
  GameSession,
  GameSessions,
} from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionUnderWay } from '@libs/game-session-shared-ts/game-session-state';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import type { TopicMapEntry } from '@pkgs/sync-engine-shared-ts/topic-map';
import { z } from 'zod';

/**
 * Who sits in the game session under way in a space, one row per person and
 * space, read on every device of that person: the game sessions themselves
 * live in the space's room, which a device outside the space never reads,
 * so this is how such a device knows there is a game session to return to.
 * A device in the space notes what its room says; the server checks it
 * against the room before keeping it.
 */
export const gameSessionSeats = defineTable({
  domain: GAME_PLATFORM_NAMESPACE,
  name: 'chess_custom_game_seats',
  columns: {
    owner_id: 'text',
    space_id: 'text',
    custom_game_id: 'text',
    under_way: 'boolean',
  },
  uniqueIndexes: [['owner_id', 'space_id']],
});

export const GAME_SESSION_SEATS_TABLES = [gameSessionSeats] as const;

/** A row reaches only its owner's devices. */
export const GAME_SESSION_SEATS_TOPIC_MAP = {
  chess_custom_game_seats: {
    topics(row, ctx) {
      return [`user:${String(row['owner_id'] ?? ctx.actorId)}`];
    },
  } satisfies TopicMapEntry,
} as const;

/** The people seated in a game session, each once, in order. */
export function gameSessionSeatedPeople(game: GameSession): readonly string[] {
  const people = game.sides.flatMap((side) => {
    const seat = game[side];
    return seat.kind === 'person' && seat.person !== undefined
      ? [seat.person]
      : [];
  });
  return [...new Set(people)].sort();
}

export const noteGameSessionSeatsArgs = z.object({
  spaceId: z.string().min(1),
  customGameId: z.string().min(1),
  /** Who sits in it, when it is under way. */
  people: z.array(z.string().min(1)).max(8),
  underWay: z.boolean(),
});

export type NoteGameSessionSeats = z.infer<typeof noteGameSessionSeatsArgs>;

/** What a device in the space notes about its room's game session now. */
export function gameSessionSeatsNote(
  spaceId: string,
  games: GameSessions
): NoteGameSessionSeats | null {
  const game = games.current ?? games.history.at(-1) ?? null;
  if (game === null) return null;
  const underWay = gameSessionUnderWay(games);
  return {
    spaceId,
    customGameId: game.id,
    people: underWay ? [...gameSessionSeatedPeople(game)] : [],
    underWay,
  };
}

/** Whether `note` says what the space's room holds. */
export function gameSessionSeatsNoteHolds(
  note: NoteGameSessionSeats,
  games: GameSessions
): boolean {
  const current = games.current;
  const playing =
    current !== null &&
    current.id === note.customGameId &&
    current.status === 'active';
  if (!note.underWay) return !playing;
  return (
    playing &&
    gameSessionSeatedPeople(current).join('\n') ===
      [...new Set(note.people)].sort().join('\n')
  );
}

/**
 * Note who sits in the space's game session: under way, each of its people
 * is seated in it there, and nobody is seated in an earlier one; finished,
 * nobody is seated in it any more.
 */
export const noteGameSessionSeatsMutation = defineMutation({
  name: 'noteCustomGameSeats',
  args: noteGameSessionSeatsArgs,
  async run(ctx, args) {
    const iso = ctx.env.now().toISOString();
    if (!args.underWay) {
      await ctx.tx.run(sql`UPDATE chess_custom_game_seats
        SET under_way = ${false}, updated_at = ${iso}
        WHERE space_id = ${args.spaceId} AND custom_game_id = ${args.customGameId}
          AND under_way = ${true}`);
      return;
    }
    await ctx.tx.run(sql`UPDATE chess_custom_game_seats
      SET under_way = ${false}, updated_at = ${iso}
      WHERE space_id = ${args.spaceId} AND custom_game_id <> ${args.customGameId}
        AND under_way = ${true}`);
    const people = [...new Set(args.people)];
    if (people.length === 0) return;
    await ctx.tx.run(sql`INSERT INTO chess_custom_game_seats
      (id, owner_id, space_id, custom_game_id, under_way, created_at, updated_at, deleted_at)
      VALUES ${join(
        people.map(
          (person) =>
            sql`(${`${person}:${args.spaceId}`}, ${person}, ${args.spaceId}, ${args.customGameId}, ${true}, ${iso}, ${iso}, ${null})`
        )
      )}
      ON CONFLICT (id) DO UPDATE SET custom_game_id = excluded.custom_game_id,
        under_way = excluded.under_way, updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at`);
  },
});

/** The person's own seats, on every device of theirs. */
export const gameSessionSeatsQuery = defineQuery({
  name: 'customGameSeats',
  async run(ctx) {
    return {
      chess_custom_game_seats: await ctx.db.query(
        sql`SELECT * FROM chess_custom_game_seats WHERE owner_id = ${ctx.env.actorId}`
      ),
    };
  },
});
