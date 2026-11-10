/**
 * The moves people see a Synthetic User make: each position change on a
 * person's board in the game, and when it showed, as the person saw it.
 */
import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticGameView } from './synthetic-game-actions';

export type MoveSeen = {
  /** When the position before it first showed. */
  readonly sinceMs: number;
  /** When the move showed. */
  readonly atMs: number;
  readonly before: string;
  readonly after: string;
};
type Watch = { position: string | null; since: number; moves: MoveSeen[] };
const watches = new WeakMap<ProductHarness, Map<string, Watch>>();

/** The people (not Synthetic Users) among the scenario's actors. */
async function people(s: ProductHarness): Promise<string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      account_id: string;
    }>`SELECT account_id FROM population_users WHERE account_id IS NOT NULL AND deleted_at IS NULL`
  );
  const synthetic = new Set(rows.map((row) => row.account_id));
  const found: string[] = [];
  for (const actor of s.actors.keys()) {
    const account = await signedInAccountOf(s, actor);
    if (account !== null && !synthetic.has(account)) found.push(actor);
  }
  return found;
}

/** Look at every person's board once and note a move that has shown since. */
export async function recordMovesSeen(s: ProductHarness): Promise<void> {
  const known = watches.get(s) ?? new Map<string, Watch>();
  watches.set(s, known);
  for (const person of await people(s)) {
    await bringToFront(s, person);
    const board = await syntheticGameView(s, person);
    const now = s.harness.clock.now();
    const watch = known.get(person) ?? {
      position: null,
      since: now,
      moves: [],
    };
    known.set(person, watch);
    if (board.position === null || board.position === watch.position) continue;
    if (watch.position !== null)
      watch.moves.push({
        sinceMs: watch.since,
        atMs: now,
        before: watch.position,
        after: board.position,
      });
    watch.position = board.position;
    watch.since = now;
  }
}

/** The moves `person` has seen, with how long each took to come and whether the game allows it. */
export function movesSeenBy(s: ProductHarness, person: string) {
  return (watches.get(s)?.get(person)?.moves ?? []).map((move) => {
    const rules = GAME_AUTOMATIONS.find((game) =>
      game.rules.recognizes(move.before)
    )?.rules;
    return {
      thinkingMs: move.atMs - move.sinceMs,
      legal: rules?.recognizes(move.after) === true,
    };
  });
}
