import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import {
  MAX_QUERY_BATCH,
  MAX_QUERY_BODY_BYTES,
} from '@pkgs/sync-engine-shared-ts/bounds';
import type {
  QueryRequestItem,
  QueryResponse,
} from '@pkgs/sync-engine-shared-ts/v2';
import { validateWireQueryBatch } from './query-wire-validation';

const encoder = new TextEncoder();
const EMPTY_BODY_BYTES = encoder.encode(
  JSON.stringify({ queries: [] })
).byteLength;

/**
 * Split a sweep into batches the server accepts: at most `MAX_QUERY_BATCH`
 * queries and `MAX_QUERY_BODY_BYTES` of `{ queries }` body each.
 */
function protocolChunks(
  requests: readonly QueryRequestItem[]
): QueryRequestItem[][] {
  const chunks: QueryRequestItem[][] = [];
  let chunk: QueryRequestItem[] = [];
  let bytes = EMPTY_BODY_BYTES;
  for (const request of requests) {
    const size = encoder.encode(JSON.stringify(request)).byteLength;
    const full =
      chunk.length === MAX_QUERY_BATCH ||
      bytes + size + 1 > MAX_QUERY_BODY_BYTES;
    if (chunk.length > 0 && full) {
      chunks.push(chunk);
      chunk = [];
      bytes = EMPTY_BODY_BYTES;
    }
    bytes += size + (chunk.length > 0 ? 1 : 0);
    chunk.push(request);
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

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
  for (const chunk of protocolChunks(requests)) {
    const responses = validateWireQueryBatch(
      await postQueries(chunk),
      chunk.length
    );
    out.push(...responses);
  }
  return out;
}
