import { isSyntheticAddress } from '@libs/synthetic-population-shared/synthetic-address';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type { Lease, SyntheticPopulationPorts } from './records';
import { isoAt } from './records';

/** One sign-in mail, as the auth service hands it to its host. */
export type SignInMail = {
  /** The address the link signs in. */
  readonly email: string;
  /** What the addressee opens to finish signing in. */
  readonly link: string;
  /** Epoch milliseconds after which the link no longer works. */
  readonly expiresAt: number;
};

export type SignInInboxPorts = Pick<
  SyntheticPopulationPorts,
  'clock' | 'createId'
>;

export type TakenSignInLink =
  | { readonly owned: false }
  | { readonly owned: true; readonly link: string | null };

/**
 * The internal inbox. Mail addressed to a Synthetic User is never sent: it is
 * kept here, in every environment, until the user's leased worker takes the
 * link over the control plane. Nothing else reads it.
 */
export class SignInInbox {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: SignInInboxPorts
  ) {}

  /**
   * Keeps one mail for a Synthetic User a worker is running right now; mail
   * for anyone else is dropped unread. An earlier link to the same address is
   * erased, so only the newest can ever be taken.
   */
  async deliver(mail: SignInMail): Promise<void> {
    const email = mail.email.trim().toLowerCase();
    if (!isSyntheticAddress(email)) return;
    const now = isoAt(this.ports.clock.now());
    await this.db.transaction(async (tx) => {
      const leased = await tx.query(
        sql<{
          id: string;
        }>`SELECT id FROM population_users WHERE email = ${email} AND worker_id IS NOT NULL AND lease_until > ${now} AND deleted_at IS NULL`
      );
      if (leased.length === 0) return;
      await tx.run(
        sql`UPDATE population_sign_in_mail SET link = ${null}, deleted_at = ${now}, updated_at = ${now} WHERE email = ${email} AND deleted_at IS NULL`
      );
      await tx.run(
        sql`INSERT INTO population_sign_in_mail (id, created_at, updated_at, email, link, expires_at) VALUES (${this.ports.createId()}, ${now}, ${now}, ${email}, ${mail.link}, ${isoAt(mail.expiresAt)})`
      );
    });
  }

  /**
   * Hands the leased user's newest unexpired link to its worker, once. Taking
   * empties the user's inbox: every row is soft-deleted with its link erased,
   * so a link is never readable again, here or in the table.
   */
  async take(lease: Omit<Lease, 'expiresAt'>): Promise<TakenSignInLink> {
    const now = isoAt(this.ports.clock.now());
    return this.db.transaction(async (tx) => {
      const owners = await tx.query(
        sql<{
          email: string;
        }>`SELECT email FROM population_users WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${now} AND deleted_at IS NULL`
      );
      const owner = owners[0];
      if (owner === undefined) return { owned: false };
      const newest = await tx.query(
        sql<{
          id: string;
          link: string | null;
        }>`SELECT id, link FROM population_sign_in_mail WHERE email = ${owner.email} AND expires_at > ${now} AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`
      );
      // The erasure is the claim: a concurrent take finds nothing left to erase.
      const erased = await tx.query(
        sql<{
          id: string;
        }>`UPDATE population_sign_in_mail SET link = ${null}, deleted_at = ${now}, updated_at = ${now} WHERE email = ${owner.email} AND deleted_at IS NULL RETURNING id`
      );
      const mail = newest[0];
      const claimed =
        mail !== undefined && erased.some((row) => row.id === mail.id);
      return { owned: true, link: claimed ? mail.link : null };
    });
  }
}

/**
 * Where the auth service's sign-in links go: into the internal inbox, for
 * Synthetic User addresses only. Any other address is never accepted, so a
 * person can never be mailed a link, and nothing is ever sent outside.
 */
export function syntheticPopulationSignInMail(deps: {
  readonly getDb: () => SqlClient;
  readonly ports: SignInInboxPorts;
}) {
  return {
    accepts: (email: string): boolean => isSyntheticAddress(email),
    deliver: (mail: SignInMail): Promise<void> =>
      new SignInInbox(deps.getDb(), deps.ports).deliver(mail),
  };
}
