import { stopFindingOpponentMutation } from '@libs/game-matchmaking-shared-ts/stop-finding-opponent-mutation';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { holdStackLock } from '@libs/harness-ts/stack-lock';
import { stackManifestPath } from '@libs/harness-ts/stack-manifest';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { multiplayerTransaction } from './multiplayer-fixtures-core';

/**
 * Longest a run waits for another run's scenario to leave the opponent pool:
 * under a scenario's own budget, so a run that cannot get in says so.
 */
const POOL_WAIT_MS = 180_000;

const held = new WeakMap<ProductHarness, Promise<() => void>>();

/**
 * The scenario enters the opponent pools and keeps them until it leaves
 * ({@link leaveOpponentPool}). Every run on one localhost stack shares one
 * set of pools, and matchmaking pairs anyone waiting in a pool: two
 * scenarios searching at once would pair one's Alice with the other's Bob.
 * In-process worlds own their pools, so this holds nothing there.
 */
export async function holdOpponentPool(s: ProductHarness): Promise<void> {
  if (stackManifestPath() === null) return;
  let hold = held.get(s);
  if (hold === undefined) {
    hold = holdStackLock('opponent-pool', POOL_WAIT_MS).then((release) => {
      // However the world ends, it never keeps the pools from the next run.
      s.session.onDispose(release);
      return release;
    });
    held.set(s, hold);
  }
  await hold;
}

/** The scenario's people stop every search they left waiting, as Stop does. */
async function stopWaitingSearches(s: ProductHarness): Promise<void> {
  const owners: string[] = [];
  for (const actor of s.actors.keys()) {
    const owner = await accountIdOf(s, actor);
    if (owner !== null) owners.push(owner);
  }
  if (owners.length === 0) return;
  const waiting = await s.harness.serverSql.sqlClient.query(sql<{
    owner_id: string;
    search_id: string;
  }>`SELECT owner_id, search_id FROM chess_opponent_searches
    WHERE owner_id IN (${join(owners)}) AND standing = 'waiting' AND deleted_at IS NULL`);
  for (const search of waiting)
    await multiplayerTransaction(s, search.owner_id, async (tx, env) => {
      await stopFindingOpponentMutation.run(
        { tx, env },
        { requestId: s.session.ports.createId(), searchId: search.search_id }
      );
      return [search.owner_id];
    });
}

/**
 * The scenario leaves the pools it entered: its people's searches stop, so
 * none is left waiting for the next run's people, and another run may enter.
 */
export async function leaveOpponentPool(s: ProductHarness): Promise<void> {
  const hold = held.get(s);
  if (hold === undefined) return;
  held.delete(s);
  const release = await hold;
  try {
    await stopWaitingSearches(s);
  } finally {
    release();
  }
}
