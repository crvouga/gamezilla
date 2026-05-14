import { asKeyword, joinKeywordSegments } from '@gamezilla/lib/keyword';
import type { Keyword } from '@gamezilla/lib/keyword';

/**
 * {@link Keyword}s for {@link KeyValueClientRoomStorage} under a space id.
 * Encodes `spaceId` into wire-valid namespace segments (UUIDs alone are not
 * valid keyword segments because they can start with a digit).
 */
export function keyValueRoomClientKeywords(spaceId: string): {
  committed: Keyword;
  queue: Keyword;
} {
  const body = spaceId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seg = body.length > 0 ? `s${body}` : 'sx';
  const ns = joinKeywordSegments('room', seg);
  return {
    committed: asKeyword(`${ns}/committed`),
    queue: asKeyword(`${ns}/queue`),
  };
}
