import { billingCustomerLinkProvider } from '@libs/auth/public/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth/public/external-account-repository';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';

/**
 * The account ↔ provider-customer links, one per provider. A customer id is
 * only ever looked up under the provider that minted it.
 */
export class CustomerLinks {
  private readonly accounts: ExternalAccountRepository;

  constructor(tx: SqlTx) {
    this.accounts = new ExternalAccountRepository(tx);
  }

  customerOf(accountId: string, provider: string): Promise<string | null> {
    return this.accounts.readExternalAccountId(
      accountId,
      billingCustomerLinkProvider(provider)
    );
  }

  accountOf(provider: string, customerId: string): Promise<string | null> {
    return this.accounts.findUserIdByProviderExternalId(
      billingCustomerLinkProvider(provider),
      customerId
    );
  }

  /**
   * Links a freshly minted customer. Returns the account that owns it — not
   * `accountId` when the provider handed back a customer another account
   * already holds, which the caller must refuse.
   */
  link(args: {
    readonly accountId: string;
    readonly provider: string;
    readonly customerId: string;
    readonly now: () => number;
    readonly createId: CreateId;
  }): Promise<string> {
    return this.accounts.insertExternalAccountOrGet({
      userId: args.accountId,
      provider: billingCustomerLinkProvider(args.provider),
      externalId: args.customerId,
      now: args.now,
      createId: args.createId,
    });
  }
}
