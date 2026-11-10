import { onSchedule } from '@libs/synthetic-population-shared-ts/daily-schedule';
import { parsePersona } from '@libs/synthetic-population-shared-ts/persona';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { waitingOpponentsFor } from './opponent-demand';
import type { Lease, SyntheticPopulationPorts } from './records';
import { jsonValue } from './records';
import { onlineNow } from './synthetic-population-controller';
import { SyntheticPopulationSession } from './synthetic-population-session';

/**
 * A Worker Lease renewal, with what the Synthetic User's day and the people
 * looking for opponents ask of it: once its daily schedule is over it
 * drains (finishing any ongoing game, then closing the app), and while it
 * is available it learns whom it should become the multiplayer opponent of.
 */
export async function renewSyntheticUser(
  db: SqlClient,
  ports: SyntheticPopulationPorts,
  lease: Omit<Lease, 'expiresAt'>
) {
  const renewal = await new SyntheticPopulationSession(db, ports).renew(lease);
  if (renewal === null) return null;
  const rows = await db.query(
    sql<{
      personality: unknown;
    }>`SELECT personality FROM population_users WHERE id = ${lease.userId}`
  );
  const persona = parsePersona(jsonValue(rows[0]?.personality));
  const offSchedule =
    persona !== null && !onSchedule(persona.dailySchedule, ports.clock.now());
  // Above the desired synthetic population, counting only those not
  // finishing a game after their day, it finishes and leaves too.
  const counted = (await onlineNow(db, ports.clock.now())).filter(
    (user) => !user.finishing
  );
  const position = counted.findIndex((user) => user.id === lease.userId) + 1;
  const draining = offSchedule || position > renewal.config.desired;
  const demand =
    draining || renewal.paused
      ? { mine: [], reserved: [] }
      : await waitingOpponentsFor(db, ports, lease.userId);
  return {
    ...renewal,
    draining,
    waitingOpponents: demand.mine,
    reservedGames: demand.reserved,
  };
}
