import { billingCustomerLinkProvider } from '@libs/auth-shared-ts/external-account-providers';
import { ExternalAccountRepository } from '@libs/auth-shared-ts/external-account-repository';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';

export type CustomerLinkOutcome =
  | { readonly kind: 'linked' }
  | { readonly kind: 'taken' }
  | { readonly kind: 'already'; readonly customerId: string };

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
   * Links a freshly minted customer, unless something already holds a link:
   * - `linked` — the account now holds `customerId` (or already did);
   * - `taken` — another account holds `customerId`, which the caller must
   *   refuse: paying through it would credit that account;
   * - `already` — the account already holds another customer at this
   *   provider (a concurrent first checkout linked it first), which the
   *   caller uses instead.
   */
  async link(args: {
    readonly accountId: string;
    readonly provider: string;
    readonly customerId: string;
    readonly now: () => number;
    readonly createId: CreateId;
  }): Promise<CustomerLinkOutcome> {
    const provider = billingCustomerLinkProvider(args.provider);
    await this.accounts.insertExternalAccountIfAbsent({
      userId: args.accountId,
      provider,
      externalId: args.customerId,
      now: args.now,
      createId: args.createId,
    });
    const owner = await this.accounts.findUserIdByProviderExternalId(
      provider,
      args.customerId
    );
    if (owner === args.accountId) return { kind: 'linked' };
    if (owner !== null) return { kind: 'taken' };
    const held = await this.accounts.readExternalAccountId(
      args.accountId,
      provider
    );
    if (held === null) {
      throw new Error(
        `billing: customer link missing after insert (${args.provider})`
      );
    }
    return { kind: 'already', customerId: held };
  }
}
