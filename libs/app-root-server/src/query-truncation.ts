import type { Logger } from '@pkgs/logger-shared/logger';
import { createMetric } from '@pkgs/observability-root-shared/metric-contract';
import type { QueryTruncation } from '@pkgs/sync-engine-server/run-query';

/**
 * Count each snapshot clipped to its query limit. Production serves the
 * clipped rows (outside production the clip throws), so without this count a
 * person silently sees part of their data. The log names the query and its
 * limit only; no row content leaves the server.
 */
export function countTruncatedQuery(
  log: Pick<Logger, 'warn'>
): (clip: QueryTruncation) => void {
  return (clip) => {
    log.warn('query snapshot truncated at its limit', {
      queryName: clip.queryName,
      limit: clip.limit,
    });
    createMetric({
      name: 'sync.query.truncations',
      description: 'Query snapshots clipped to their row limit',
      type: 'counter',
      unit: '{snapshot}',
      dimensions: {},
      environmentScoped: true,
    })(1, {});
  };
}
