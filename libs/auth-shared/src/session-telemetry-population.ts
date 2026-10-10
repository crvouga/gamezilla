import { isSyntheticPopulationAddress } from '@libs/synthetic-population-shared/telemetry-population';
import type { VerifiedSession } from '@pkgs/auth-root-shared/verified-session';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';

/** A normal identity-provider session does not prove the actor is a customer. */
export async function sessionTelemetryPopulation(
  tx: SqlTx,
  session: VerifiedSession
): Promise<boolean | undefined> {
  if (session.synthetic === true) return true;
  if (await isSyntheticPopulationAddress(tx, session.email)) return true;
  return session.synthetic;
}
