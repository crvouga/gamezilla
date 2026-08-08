import { resolveQueryHydrates } from '../queries/core/define-query';
import type { QueryDef } from '../queries/core/types';
import type { TopicMap } from './topic-map';

export type ChannelGap = {
  readonly table: string;
  readonly query: string;
  readonly reason: string;
};

function entryChannelEmpty(query: QueryDef<unknown>): boolean {
  if (query.entryChannel === false) return true;
  if (query.entryChannel === undefined) return false;
  return query.entryChannel({} as never, { actorId: 'actor_x' }).length === 0;
}

/**
 * Static join: every hydrated table must have a topic map entry (or the query
 * is reconcile-only with empty/false entryChannel — allowed).
 * Tables listed as reconcileOnly are skipped.
 *
 * Resolves `hydrates` via {@link resolveQueryHydrates} when not yet filled.
 */
export async function findChannelExhaustivenessGaps(
  topicMap: TopicMap,
  queries: readonly QueryDef<unknown>[],
  opts?: {
    readonly reconcileOnlyTables?: ReadonlySet<string>;
  }
): Promise<ChannelGap[]> {
  const reconcile = opts?.reconcileOnlyTables ?? new Set<string>();
  const gaps: ChannelGap[] = [];
  for (const query of queries) {
    const hydrates = await resolveQueryHydrates(query);
    const entryEmpty = entryChannelEmpty(query);
    for (const table of hydrates) {
      if (reconcile.has(table)) continue;
      if (topicMap[table] !== undefined) continue;
      if (
        entryEmpty &&
        hydrates.every((t) => reconcile.has(t) || topicMap[t] === undefined)
      ) {
        // reconcile-only query (e.g. chessPuzzlePool)
        continue;
      }
      if (topicMap[table] === undefined) {
        gaps.push({
          table,
          query: query.name,
          reason:
            'hydrated table has no topicMap entry (add map or mark reconcile-only)',
        });
      }
    }
  }
  return gaps;
}

export async function assertChannelExhaustiveness(
  topicMap: TopicMap,
  queries: readonly QueryDef<unknown>[],
  opts?: {
    readonly reconcileOnlyTables?: ReadonlySet<string>;
  }
): Promise<void> {
  const gaps = await findChannelExhaustivenessGaps(topicMap, queries, opts);
  if (gaps.length === 0) return;
  const lines = gaps.map(
    (g) =>
      `CHANNEL_EXHAUST: table "${g.table}" hydrated by query "${g.query}": ${g.reason}`
  );
  throw new Error(`Channel exhaustiveness failed:\n${lines.join('\n')}`);
}
