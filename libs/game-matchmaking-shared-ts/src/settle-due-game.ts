import { serviceSyncActor } from '@libs/auth-shared-ts/auth-context';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { MultiplayerGameRepository } from './game-repository';
import {
  multiplayerDeadlineMs,
  settleMultiplayerClock,
} from './multiplayer-clock';
import { multiplayerPeople } from './multiplayer-roster';
import { synchronizeLiveMatchMutation } from './synchronize-live-match-mutation';

async function projectLiveMatch(
  tx: SqlTx,
  deadline: { gameId: string; nowMs: number; createId: () => string },
  rules: TurnGames,
  rooms: RoomServicePort | undefined
): Promise<void> {
  if (rooms === undefined)
    throw new Error('live match projection requires the injected room service');
  const env: MutationEnv = {
    ...serviceSyncActor(ROOM_SERVICE_IDENTITY),
    now: () => new Date(deadline.nowMs),
    serverNow: () => new Date(deadline.nowMs),
    createId: deadline.createId,
    turnGames: rules,
    rooms,
  };
  await synchronizeLiveMatchMutation.run(
    { tx: wrapMutationDb(tx, env).tx, env },
    { gameId: deadline.gameId, requestId: `projection:${deadline.nowMs}` }
  );
}

/**
 * The scheduled sweep's half of a deadline: applies a missed first move or a
 * flag that fell due, whoever is online. Returns the people to notify.
 *
 * It takes both people's owner lock and reads the game again under it, as
 * every command does, so a move, resignation or agreement committed while
 * the sweep waited is what it settles from: a game that already ended is
 * left alone, rated and freed once by the transaction that ended it.
 */
export async function settleDueGame(
  tx: SqlTx,
  deadline: { gameId: string; nowMs: number; createId: () => string },
  rules: TurnGames,
  rooms?: RoomServicePort
): Promise<readonly string[]> {
  const { gameId, nowMs, createId } = deadline;
  const repository = new MultiplayerGameRepository(tx);
  const found = await repository.byId(gameId);
  if (found === null) return [];
  const simulated =
    rules.simulation(rules.forPosition(found.fen).id) !== undefined;
  const due = multiplayerDeadlineMs(found);
  // Old move deadlines remain durable, but cannot settle this newer state.
  if (!simulated && (due === null || due > nowMs)) return [];
  const stored = await repository.owned(gameId, found.white_id, nowMs);
  if (stored.outcome !== 'ongoing') return [];
  if (rules.simulation(rules.forPosition(stored.fen).id) !== undefined) {
    await projectLiveMatch(tx, deadline, rules, rooms);
    return multiplayerPeople(stored);
  }
  const settled = settleMultiplayerClock(stored, nowMs, rules);
  if (settled === stored) return [];
  await repository.save(stored, settled, nowMs, {
    server: true,
    publish: { createId },
  });
  return multiplayerPeople(stored);
}
