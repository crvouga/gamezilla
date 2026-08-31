import { assert } from '@pkgs/assert';

import type { QueryRequestItem } from '../protocol';
import type { QueryResponse } from '../queries/core/types';
import { MAX_QUERY_BATCH } from '../queries/shared/bounds';
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
