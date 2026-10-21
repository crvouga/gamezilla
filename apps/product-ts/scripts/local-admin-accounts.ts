import type { Account } from '@crvouga/mockingbird-service-oauth';

export type LocalAdminIdentity = {
  readonly provider: 'google' | 'apple';
  readonly providerUserId: string;
  readonly email: string;
  readonly name: string;
};

/** Ask the simulator for the subject this client receives, including Apple's scoped IDs. */
export async function localAdminIdentities(
  provider: LocalAdminIdentity['provider'],
  clientId: string,
  runtime: {
    instance(): {
      grant(
        clientId: string,
        accountId: string
      ): Promise<{ subject: string } | null>;
    };
  }
): Promise<readonly LocalAdminIdentity[]> {
  return Promise.all(
    LOCAL_ADMIN_ACCOUNTS.map(async (account) => {
      const grant = await runtime.instance().grant(clientId, account.id);
      if (grant === null)
        throw new Error(`Missing local admin ${account.email}`);
      return {
        provider,
        providerUserId: grant.subject,
        email: account.email,
        name: account.name,
      };
    })
  );
}

/** Shared by both local provider choosers and the app-account seeder. */
export const LOCAL_ADMIN_ACCOUNTS: readonly Account[] = [
  {
    id: 'admin-gmail-com',
    email: 'admin@gmail.com',
    name: 'Admin One',
    givenName: 'Admin',
    familyName: 'One',
  },
  {
    id: 'admin2-gmail-com',
    email: 'admin2@gmail.com',
    name: 'Admin Two',
    givenName: 'Admin',
    familyName: 'Two',
  },
];
