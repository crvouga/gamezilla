import { onSchedule } from '@libs/synthetic-population-shared-ts/daily-schedule';
import type { OpponentDemand } from '@libs/synthetic-population-shared-ts/decision-policy';
import { parsePersona } from '@libs/synthetic-population-shared-ts/persona';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { SyntheticPopulationPorts } from './records';
import { isoAt, jsonValue } from './records';

/** A person searching this long with nobody found is waiting for a Synthetic User. */
export const WAITING_GRACE_MS = 3_000;
/** What a Synthetic User is doing when it can become a person's opponent. */
const AVAILABLE = ['browsing', 'hosting', 'joining', 'postGame'] as const;
const POOL_KEY = 'matchmaking/pool';

type Search = {
  owner_id: string;
  time_control: string | null;
  joined_at_ms: number;
  data: unknown;
};
type Available = { id: string; account_id: string; personality: unknown };

/** The registered game a waiting search's pool names (`<game id>.<choice>`). */
function gameOf(data: unknown): string | null {
  const value = jsonValue(data);
  if (typeof value !== 'object' || value === null) return null;
  const pool = (value as Record<string, unknown>)[POOL_KEY];
  if (typeof pool !== 'string') return null;
  const dot = pool.lastIndexOf('.');
  return dot <= 0 ? null : pool.slice(0, dot);
}

async function latestOpponent(
  tx: SqlTx,
  person: string
): Promise<string | null> {
  const rows = await tx.query(
    sql<{
      white_id: string | null;
      black_id: string | null;
    }>`SELECT white_id, black_id FROM chess_multiplayer_games WHERE (white_id = ${person} OR black_id = ${person}) AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`
  );
  const game = rows[0];
  if (game === undefined) return null;
  return game.white_id === person ? game.black_id : game.white_id;
}

/**
 * The people a Synthetic User should become the multiplayer opponent of
 * (`mine`), and the games where people wait for another one (`reserved`),
 * which it leaves alone:
 * everyone searching with nobody found is given one available Synthetic
 * User, in the order they started searching, a different one from their
 * latest opponent whenever another is available.
 */
export async function waitingOpponentsFor(
  tx: SqlTx,
  ports: SyntheticPopulationPorts,
  userId: string
): Promise<{ mine: OpponentDemand[]; reserved: string[] }> {
  const nowMs = ports.clock.now();
  const users = await tx.query(
    sql<Available>`SELECT id, account_id, personality FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${isoAt(nowMs)} AND paused = ${false} AND account_id IS NOT NULL AND deleted_at IS NULL AND activity IN (${AVAILABLE[0]}, ${AVAILABLE[1]}, ${AVAILABLE[2]}, ${AVAILABLE[3]}) ORDER BY id LIMIT 1000`
  );
  const available = users.filter((user) => {
    const persona = parsePersona(jsonValue(user.personality));
    return persona === null || onSchedule(persona.dailySchedule, nowMs);
  });
  if (!available.some((user) => user.id === userId))
    return { mine: [], reserved: [] };
  const synthetic = new Set(
    (
      await tx.query(
        sql<{
          account_id: string;
        }>`SELECT account_id FROM population_users WHERE account_id IS NOT NULL AND deleted_at IS NULL LIMIT 10000`
      )
    ).map((row) => row.account_id)
  );
  const searches = await tx.query(
    sql<Search>`SELECT s.owner_id, s.time_control, s.joined_at_ms, w.data FROM chess_opponent_searches AS s JOIN matchmaking_waiting AS w ON w.id = s.search_id WHERE s.standing = ${'waiting'} AND s.deleted_at IS NULL AND w.deleted_at IS NULL AND s.joined_at_ms <= ${nowMs - WAITING_GRACE_MS} ORDER BY s.joined_at_ms, s.owner_id LIMIT 200`
  );
  const demand: OpponentDemand[] = [];
  const reserved = new Set<string>();
  for (const search of searches) {
    const gameId = gameOf(search.data);
    if (synthetic.has(search.owner_id) || gameId === null) continue;
    if (available.length === 0) break;
    const latest = await latestOpponent(tx, search.owner_id);
    const index = available.findIndex((user) => user.account_id !== latest);
    const [chosen] = available.splice(Math.max(0, index), 1);
    if (chosen?.id === userId)
      demand.push({ gameId, timeControl: search.time_control ?? '' });
    else reserved.add(gameId);
  }
  return { mine: demand, reserved: [...reserved] };
}
