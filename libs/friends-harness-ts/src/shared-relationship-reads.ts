import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import sql from '@pkgs/sql-root-shared-ts/sql';

type Relation = 'friendship' | 'pending' | 'block' | 'declined';
type PairRow = {
  readonly relation: Relation;
  readonly from_id: string;
  readonly to_id: string;
};
const KEY = {
  friendship: 'friendships',
  pending: 'friendRequests',
  block: 'blocks',
  declined: 'declined',
} as const;

async function accountNames(
  s: ProductHarness,
  people: readonly string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const person of people) {
    const account = await accountIdOf(s, person);
    if (account === null) throw new Error(`${person} has no account`);
    names.set(account, person);
  }
  return names;
}

function relationshipSets(
  rows: readonly PairRow[],
  names: ReadonlyMap<string, string>
): Record<string, Set<QuintValue>> {
  const result: Record<string, Set<QuintValue>> = {
    friendships: new Set(),
    friendRequests: new Set(),
    blocks: new Set(),
    declined: new Set(),
  };
  const seen = new Set<string>();
  for (const row of rows) {
    const from = names.get(row.from_id);
    const to = names.get(row.to_id);
    if (from === undefined || to === undefined)
      throw new Error('Relationship refers to a person outside the model');
    const pair = row.relation === 'friendship' ? [from, to].sort() : [from, to];
    const key = `${row.relation}:${pair.join('>')}`;
    if (seen.has(key)) throw new Error(`Duplicate relationship ${key}`);
    seen.add(key);
    result[KEY[row.relation]]!.add(
      row.relation === 'friendship' ? new Set(pair) : pair
    );
  }
  return result;
}

/** Shared relationships, including changes an offline person has not learned. */
export async function sharedRelationships(
  s: ProductHarness,
  people: readonly string[]
): Promise<Record<string, Set<QuintValue>>> {
  const names = await accountNames(s, people);
  const since = new Date(s.harness.clock.now() - 86_400_000).toISOString();
  const rows = await s.harness.serverSql.sqlClient.query(sql<PairRow>`
    SELECT 'friendship' AS relation, user_low AS from_id, user_high AS to_id
    FROM friends_friendships WHERE deleted_at IS NULL
    UNION ALL
    SELECT status AS relation, from_user_id AS from_id, to_user_id AS to_id
    FROM friends_requests WHERE deleted_at IS NULL
      AND (status = 'pending' OR (status = 'declined' AND responded_at > ${since}))
    UNION ALL
    SELECT 'block' AS relation, blocker_id AS from_id, blocked_id AS to_id
    FROM friends_blocks WHERE deleted_at IS NULL
  `);
  return relationshipSets(rows, names);
}
