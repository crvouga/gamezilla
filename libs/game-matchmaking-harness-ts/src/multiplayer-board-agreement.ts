import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import {
  MULTIPLAYER_GAME_COLUMNS,
  type MultiplayerGame,
} from '@libs/game-matchmaking-shared-ts/game-state';
import {
  matchRoomGame,
  matchRoomTopic,
} from '@libs/game-matchmaking-shared-ts/match-room';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorLocalSql, playerIdOf } from '@libs/harness-ts/identity';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { multiplayerBoardShown } from './multiplayer-board';
import { multiplayerSpaceId } from './multiplayer-spaces';

export type BoardPair = readonly [
  MultiplayerGame | null,
  MultiplayerGame | null,
];

type Result = Pick<MultiplayerGame, 'id' | 'revision' | 'outcome' | 'reason'>;

function result(game: Result | null) {
  if (game === null) return 'missing';
  return `${game.id}@${game.revision}:${game.outcome}${game.reason ? `/${game.reason}` : ''}`;
}

async function probe(read: () => Promise<string>) {
  try {
    return await read();
  } catch (error) {
    return `unavailable (${String(error).slice(0, 160)})`;
  }
}

async function topicSequences(s: ProductHarness, actor: string) {
  const db = actorLocalSql(s, actor);
  if (db === null) return 'no local database';
  const owner = await playerIdOf(s, actor);
  const space = await multiplayerSpaceId(s, actor);
  const topics = [`user:${owner}`, `room:${space}`];
  const local = await db.query(sql<{ topic: string; last_push_seq: string }>`
    SELECT topic, last_push_seq FROM sync_engine_push_applied WHERE topic IN (${join(topics)})`);
  const allocated = await s.harness.serverSql.sqlClient.query(sql<{
    topic: string;
    n: number;
  }>`
    SELECT topic, n FROM sync_engine_topic_seq WHERE topic IN (${join(topics)})`);
  return topics
    .map((topic) => {
      const received = local.find((row) => row.topic === topic)?.last_push_seq;
      const sent = allocated.find((row) => row.topic === topic)?.n;
      return `${topic.split(':')[0]}=${received ?? 'none'}/${sent ?? 'none'}`;
    })
    .join(',');
}

/** Device SQL is the last pair actually compared. Read the other surfaces only after a failure. */
export async function describeBoardAgreement(
  s: ProductHarness,
  actors: readonly [string, string],
  boards: BoardPair,
  gameId: string | undefined
) {
  const [a, b] = boards;
  const fields = MULTIPLAYER_GAME_COLUMNS.filter(
    (key) => a?.[key] !== b?.[key]
  );
  const details = [
    `${actors[0]}.local=${result(a)}`,
    `${actors[1]}.local=${result(b)}`,
    `different=${fields.join(',') || 'none'}`,
  ];
  for (const actor of actors) {
    const screen = await probe(async () => {
      const board = await multiplayerBoardShown(s, actor);
      return board.gameId === null
        ? 'missing'
        : `${board.gameId}@${board.revision}:${board.outcome}`;
    });
    details.push(
      `${actor}.screen=${screen}`,
      `${actor}.pushFloor/allocated=${await probe(() => topicSequences(s, actor))}`
    );
  }
  if (gameId !== undefined) {
    const server = await probe(async () =>
      result(
        await new MultiplayerGameRepository(s.harness.serverSql.sqlClient).byId(
          gameId
        )
      )
    );
    const room = await probe(async () =>
      result(
        matchRoomGame(
          await s.harness.roomNode.services.read(matchRoomTopic(gameId))
        )
      )
    );
    details.push(`server=${server}`, `room=${room}`);
  }
  return details.join(' ');
}
