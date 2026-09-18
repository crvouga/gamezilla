import { useMyId } from '@libs/auth/public/use-current-user';
import { useClock } from '@pkgs/clock/solid';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

type CountRow = {
  readonly value: number;
};

/** Distinct puzzles attempted today (UTC), for the per-tier daily cap. */
export function usePuzzlesPlayedToday(): Accessor<number> {
  const myId = useMyId();
  const clock = useClock();
  const dayStart = createMemo(() => {
    const now = new Date(clock.now());
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();
  });
  const query = createQuery(
    () => sql<CountRow>`
    SELECT COUNT(DISTINCT puzzle_id) AS value
    FROM chess_puzzle_interactions
    WHERE owner_id = ${myId()} AND at >= ${dayStart()}
  `
  );
  return createMemo(() => Number(query.rows()[0]?.value ?? 0));
}
