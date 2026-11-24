import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { begunGamesSql } from '@libs/game-matchmaking-shared-ts/game-repository';
import { useMatchedGameAllowance } from '@libs/permissions-client-ts/use-can';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';

/**
 * Today's matched game allowance from this device's synced copy of the
 * person's matched games (all of them, in every game, reach the device): the
 * same games the server counts, so the screen refuses or shows what is left
 * as the server would, and the server still decides.
 */
export function useMatchedGameToday() {
  const myId = useMyId();
  const begun = createQuery(() => begunGamesSql(myId()));
  return useMatchedGameAllowance(() =>
    begun.rows().map((row) => row.created_at)
  );
}
