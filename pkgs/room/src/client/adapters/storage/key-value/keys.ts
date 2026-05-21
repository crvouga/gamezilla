import { asKeyword, joinKeywordSegments } from '@pkgs/keyword';
import type { Keyword } from '@pkgs/keyword';

/**
 * {@link Keyword}s for {@link KeyValueClientRoomStorage} under a space id.
 * Encodes `spaceId` into wire-valid namespace segments (UUIDs alone are not
 * valid keyword segments because they can start with a digit).
 *
 * Local segments `committed-kv2` / `queue-kv2` avoid reading legacy JSON blobs
 * (`{ lastSeq, entries }` etc.) that are not {@link KvRecord}s.
 */
export function keyValueRoomClientKeywords(spaceId: string): {
  committed: Keyword;
  queue: Keyword;
} {
  const body = spaceId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seg = body.length > 0 ? `s${body}` : 'sx';
  const ns = joinKeywordSegments('room', seg);
  return {
    committed: asKeyword(`${ns}/committed-kv2`),
    queue: asKeyword(`${ns}/queue-kv2`),
  };
}
