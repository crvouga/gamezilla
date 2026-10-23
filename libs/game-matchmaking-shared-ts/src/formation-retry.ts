import { insertOutboxEvent } from '@pkgs/outbox-shared-ts/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { GAME_PLATFORM_NAMESPACE } from './durable-names';
import { OpponentRequested } from './opponent-requested';

/** How soon a pool with people still waiting is paired again. */
export const FORMATION_RETRY_MS = 5_000;

/**
 * Every formation retry's outbox id starts with this, in the platform's
 * durable namespace, followed by the retry's slot.
 */
export const FORMATION_RETRY_EVENT_PREFIX = `${GAME_PLATFORM_NAMESPACE}.opponent-requested:retry:`;

/**
 * Ranges grow while people wait, so a pool that still has waiting people
 * is paired again shortly, even if nobody new asks.
 */
export async function scheduleFormationRetry(
  tx: SqlTx,
  nowMs: number
): Promise<void> {
  const waiting = await tx.query(sql<{ owner_id: string }>`SELECT w.owner_id
    FROM matchmaking_waiting AS w JOIN matchmaking_owners AS o ON o.id = w.owner_id
    JOIN chess_opponent_searches AS s ON s.owner_id = w.owner_id AND s.search_id = w.id
    WHERE w.deleted_at IS NULL AND o.deleted_at IS NULL AND s.deleted_at IS NULL
      AND o.available = ${true} AND o.current_id = w.id LIMIT 1`);
  const first = waiting[0];
  if (first === undefined) return;
  const at = nowMs + FORMATION_RETRY_MS;
  await insertOutboxEvent(tx, {
    id: `${FORMATION_RETRY_EVENT_PREFIX}${String(Math.floor(at / FORMATION_RETRY_MS))}`,
    message: OpponentRequested({ ownerId: first.owner_id }),
    nowIso: new Date(nowMs).toISOString(),
    availableAt: new Date(at),
  });
}
