import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * @deprecated Membership seats were removed — presence is room-local + open
 * store. Host leave already ends the space (I4), so there is nothing useful
 * to repair from Postgres alone. Kept as a no-op for the one-shot script.
 */
export async function endLiveSpacesWithoutActiveHostSeat(
  _db: SqlClient,
  _endedAt: string = new Date().toISOString()
): Promise<number> {
  return 0;
}
