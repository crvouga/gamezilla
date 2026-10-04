import { accountMutationEnv } from '@libs/auth-shared/account-mutation-env';
import type { AccountPrivacyContribution } from '@libs/feature-shared/account-privacy';
import type { Clock } from '@pkgs/clock-shared/types';
import type { RoomServicePort } from '@pkgs/room-shared/room-service';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';

type Preservation = {
  readonly accountId: string;
  readonly purpose: string;
  readonly endCondition: string;
  readonly category: string;
};
type Ports = {
  readonly rooms: RoomServicePort;
  readonly clock: Clock;
  readonly createId: () => string;
  readonly contributions: readonly AccountPrivacyContribution[];
};

/** Preserved copies have one reader and never feed account or promotion flows. */
export class LegalPreservation {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: Ports
  ) {}

  async preserve(input: Preservation): Promise<void> {
    if (!input.purpose.trim() || !input.endCondition.trim())
      throw new Error('A specific purpose and end condition are required');
    const contribution = this.ports.contributions.find(
      (entry) => entry.name === input.category
    );
    if (contribution === undefined)
      throw new Error('The obligation must name the information it covers');
    await this.db.transaction(async (tx) => {
      const now = new Date(this.ports.clock.now()).toISOString();
      const context = {
        tx,
        env: accountMutationEnv(input.accountId, this.ports),
      };
      const data = await contribution.snapshot(context, this.ports.rooms);
      await tx.run(
        sql`INSERT INTO profile_legal_preservations (id, created_at, updated_at, owner_id, purpose, end_condition, category, preserved_data) VALUES (${this.ports.createId()}, ${now}, ${now}, ${input.accountId}, ${input.purpose}, ${input.endCondition}, ${input.category}, ${JSON.stringify(data)})`
      );
      await tx.run(
        sql`INSERT INTO profile_account_privacy (id, created_at, updated_at, owner_id, legal_purpose, legal_end_condition) VALUES (${input.accountId}, ${now}, ${now}, ${input.accountId}, ${input.purpose}, ${input.endCondition}) ON CONFLICT (owner_id) DO UPDATE SET legal_purpose = ${input.purpose}, legal_end_condition = ${input.endCondition}`
      );
    });
  }

  async review(
    accountId: string,
    use: 'legal preservation' | 'ordinary account use' | 'product promotion'
  ) {
    if (use !== 'legal preservation') return [];
    return this.db.query(
      sql<{
        purpose: string;
        end_condition: string;
        category: string;
        preserved_data: string;
      }>`SELECT purpose, end_condition, category, preserved_data FROM profile_legal_preservations WHERE owner_id = ${accountId} AND deleted_at IS NULL`
    );
  }

  async release(accountId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const now = new Date(this.ports.clock.now()).toISOString();
      await tx.run(
        sql`UPDATE profile_legal_preservations SET deleted_at = ${now}, updated_at = ${now}, preserved_data = ${null}, owner_id = ${null}, purpose = ${null}, end_condition = ${null} WHERE owner_id = ${accountId} AND deleted_at IS NULL`
      );
      await tx.run(
        sql`UPDATE profile_account_privacy SET legal_purpose = ${null}, legal_end_condition = ${null} WHERE owner_id = ${accountId}`
      );
    });
  }
}
