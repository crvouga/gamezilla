import type { Snapshot } from '@pkgs/alloy-shared/world';
import type { StoredSearch } from '@pkgs/matchmaking-root-harness/stored-searches';

/** Rename persisted identities to atoms; Alloy alone judges whether the world is legal. */
export function projectSearches(
  rows: readonly StoredSearch[],
  label: string
): Snapshot {
  const owners = [...new Set(rows.map((r) => r.owner_id))];
  const searches = rows.filter((r) => r.search_id !== null);
  const matches = [
    ...new Set(
      searches.flatMap((r) => (r.match_id === null ? [] : [r.match_id]))
    ),
  ];
  const sizes = [...new Set(searches.map((r) => Number(r.group_size)))];
  const sizeId = (size: number) => `size-${String(size)}`;
  const seatId = (size: number, at: number) =>
    `${sizeId(size)}-seat-${String(at)}`;
  const seats = sizes.flatMap((size) =>
    Array.from({ length: size }, (_, at) => seatId(size, at))
  );
  const relations: Record<string, string[][]> = {
    'Seeker.owns': searches.map((r) => [r.owner_id, r.search_id!]),
    'Seeker.current': owners.flatMap((owner) => {
      const current = rows.find((r) => r.owner_id === owner)!.current_id;
      return current === null ? [] : [[owner, current]];
    }),
    'GroupSize.seats': sizes.flatMap((size) =>
      Array.from({ length: size }, (_, at) => [sizeId(size), seatId(size, at)])
    ),
    'Search.pool': searches.map((r) => [r.search_id!, r.partition_signature!]),
    'Search.state': searches.map((r) => [
      r.search_id!,
      r.match_id !== null ? 'matched' : r.ended ? 'stopped' : 'waiting',
    ]),
    'Search.requestedSize': searches.map((r) => [
      r.search_id!,
      sizeId(Number(r.group_size)),
    ]),
    'Search.assignment': searches.flatMap((r) =>
      r.match_id === null ? [] : [[r.search_id!, r.match_id]]
    ),
    'MatchGroup.waits': searches.flatMap((r) =>
      r.match_id === null ? [] : [[r.match_id, r.search_id!]]
    ),
    'MatchGroup.people': searches.flatMap((r) =>
      r.match_id === null ? [] : [[r.match_id, r.owner_id]]
    ),
    'MatchGroup.requestedSize': matches.map((match) => [
      match,
      sizeId(Number(searches.find((r) => r.match_id === match)!.group_size)),
    ]),
    'MatchGroup.seating': matches.flatMap((match) =>
      searches
        .filter((r) => r.match_id === match)
        .map((r, at) => [match, r.search_id!, seatId(Number(r.group_size), at)])
    ),
  };
  return {
    label,
    atoms: {
      Seeker: owners,
      Search: searches.map((r) => r.search_id!),
      MatchingPool: [...new Set(searches.map((r) => r.partition_signature!))],
      GroupSize: sizes.map(sizeId),
      Seat: seats,
      MatchGroup: matches,
      WaitingSearch: ['waiting'],
      StoppedSearch: ['stopped'],
      MatchedSearch: ['matched'],
    },
    relations,
  };
}
