import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';

/** An account that belongs to a Synthetic User, as the Synthetic Population knows it. */
export type SyntheticUserOfAccount = {
  /** The Synthetic User's own id, for its control panel. */
  readonly id: string;
  /** A paused Synthetic User starts no new activity. */
  readonly paused: boolean;
};

/**
 * What the User Observatory asks the Synthetic Population. The composition
 * root fills it; the observatory never reads the population's tables, and
 * an app never says what it is.
 */
export type SyntheticPopulationPort = {
  /** Which of these accounts are Synthetic Users, keyed by account. */
  readonly syntheticUsersOf: (
    tx: Pick<SqlTx, 'query'>,
    accountIds: readonly string[]
  ) => Promise<ReadonlyMap<string, SyntheticUserOfAccount>>;
  /** Records, for the team's audit, that someone started watching an app live. */
  readonly recordWatchStarted: (
    tx: SqlTx,
    watch: {
      readonly actorId: string;
      readonly sessionId: string;
      readonly watchedAccountId: string;
    }
  ) => Promise<void>;
};

/** The Synthetic Population's answers, built over the observatory's clock and ids. */
export type SyntheticPopulationPortFactory = (ports: {
  readonly clock: Clock;
  readonly createId: CreateId;
}) => SyntheticPopulationPort;

/** Ports the User Observatory needs beyond the database. */
export type ObservatoryPorts = {
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly population: SyntheticPopulationPort;
  /** Tells watchers and the observatory that someone moved or left. */
  readonly presenceChanged: () => Promise<void>;
  /** Tells a watcher that a new picture of the screen is waiting. */
  readonly frameChanged: (sessionId: string) => Promise<void>;
  /** Tells the watched account's apps, through their own sync, to look. */
  readonly wakeAccount: (accountId: string) => Promise<void>;
};

export function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}
