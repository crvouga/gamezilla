import { assert } from '@pkgs/assert-shared/singleton';

import type { QueryRequestItem } from '@pkgs/sync-engine-shared/v2';
import type { QueryResponse } from '@pkgs/sync-engine-shared/v2';
import { MAX_QUERY_BATCH } from '@pkgs/sync-engine-shared/bounds';
import { validateWireQueryBatch } from './query-wire-validation';

/** POST /query in protocol-sized chunks; validate response length per chunk. */
export async function postQueryBatch(
  postQueries: (
    requests: readonly QueryRequestItem[]
  ) => Promise<readonly QueryResponse[]>,
  requests: readonly QueryRequestItem[]
): Promise<readonly QueryResponse[]> {
  if (requests.length === 0) return [];
  assert.ok(requests.length <= MAX_QUERY_BATCH * 256, 'query sweep batch cap');
  const out: QueryResponse[] = [];
  for (let offset = 0; offset < requests.length; offset += MAX_QUERY_BATCH) {
    const chunk = requests.slice(offset, offset + MAX_QUERY_BATCH);
    const responses = validateWireQueryBatch(
      await postQueries(chunk),
      chunk.length
    );
    out.push(...responses);
  }
  return out;
}
