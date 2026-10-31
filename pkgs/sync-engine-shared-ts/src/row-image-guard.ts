import type { TopicMap, TopicMapCtx } from './topic-map';
import type { QueryRow } from './v2';

/**
 * Drop local post-images that a topic-map `rowImage.publish` vetoes.
 * Tables without a publish guard pass through unchanged.
 */
export function filterPublishableImages(
  rows: Readonly<Record<string, readonly QueryRow[]>>,
  topicMap: TopicMap | undefined,
  ctx: TopicMapCtx
): Readonly<Record<string, readonly QueryRow[]>> {
  if (topicMap === undefined) return rows;
  let changed = false;
  const next: Record<string, readonly QueryRow[]> = {};
  for (const [table, tableRows] of Object.entries(rows)) {
    const publish = topicMap[table]?.rowImage?.publish;
    if (publish === undefined) {
      next[table] = tableRows;
      continue;
    }
    const kept = tableRows.filter((row) => publish(row, ctx));
    if (kept.length !== tableRows.length) changed = true;
    if (kept.length > 0) next[table] = kept;
  }
  return changed ? next : rows;
}
