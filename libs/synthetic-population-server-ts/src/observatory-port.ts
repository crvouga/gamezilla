import type {
  SyntheticPopulationPortFactory,
  SyntheticUserOfAccount,
} from '@libs/observatory-server-ts/ports';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { SyntheticPopulationRepository } from './synthetic-population-repository';

/**
 * What the Synthetic Population tells the User Observatory: which accounts
 * are Synthetic Users, decided from its own directory, and the audit record
 * of each watch started, kept with the population's events.
 */
export const syntheticPopulationForObservatory: SyntheticPopulationPortFactory =
  (ports) => ({
    async syntheticUsersOf(tx, accountIds) {
      const found = new Map<string, SyntheticUserOfAccount>();
      if (accountIds.length === 0) return found;
      const rows = await tx.query(sql<{
        id: string;
        account_id: string;
        paused: boolean | number | null;
      }>`SELECT id, account_id, paused FROM population_users
        WHERE account_id IN (${join([...accountIds])}) AND deleted_at IS NULL`);
      for (const row of rows)
        found.set(row.account_id, { id: row.id, paused: Boolean(row.paused) });
      return found;
    },
    async recordWatchStarted(tx, watch) {
      await new SyntheticPopulationRepository(tx, {
        ...ports,
        notify: async () => undefined,
      }).event({ name: 'LiveWatchStarted', context: { ...watch } });
    },
  });
