import type { Keyword } from '@pkgs/keyword';
import { asKeyword, joinKeywordSegments } from '@pkgs/keyword';

/**
 * {@link Keyword}s for {@link KeyValueClientRoomStorage} under a space id.
 * Encodes `spaceId` into wire-valid namespace segments (UUIDs alone are not
 * valid keyword segments because they can start with a digit).
 *
 * `committed` names the segmented-log manifest; segment blobs hang off it as
 * `<committed>-seg-<i>`. Local segments `committed-kv3` / `queue-kv2` avoid
 * reading older blob layouts that are not this shape.
 */
export function keyValueRoomClientKeywords(spaceId: string): {
  committed: Keyword;
  queue: Keyword;
} {
  const body = spaceId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seg = body.length > 0 ? `s${body}` : 'sx';
  const ns = joinKeywordSegments('room', seg);
  return {
    committed: asKeyword(`${ns}/committed-kv3`),
    queue: asKeyword(`${ns}/queue-kv2`),
  };
}

/** Segment blob key derived from the manifest key. */
export function committedSegmentKeyword(
  committed: Keyword,
  index: number
): Keyword {
  return asKeyword(`${committed}-seg-${String(index)}`);
}
