import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  CLERK_PROVIDER,
} from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/device-id';
import { assert } from '@gamezilla/lib/assert';
import type {
  Entity,
  PatchDb,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import type { AccountProvisioningPort } from '../ports';

async function findClerkAccountProvider(
  db: PatchDb,
  clerkUserId: string
): Promise<Entity | undefined> {
  const [providerResult] = await db.read(
    [
      {
        entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            {
              type: '=',
              attribute: AccountProviderAttr.provider,
              value: CLERK_PROVIDER,
            },
            {
              type: '=',
              attribute: AccountProviderAttr.providerUserId,
              value: clerkUserId,
            },
          ],
        },
        limit: 1,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return providerResult?.entities[0];
}

function patchesForNewClerkAccount(args: {
  clerkUserId: string;
  email: string | null;
  accountId: string;
}): PatchInput[] {
  const { clerkUserId, email, accountId } = args;
  const now = new Date().toISOString();
  const providerPatch: PatchInput = {
    entityId: crypto.randomUUID(),
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    attributes: {
      [AccountProviderAttr.accountId]: accountId,
      [AccountProviderAttr.provider]: CLERK_PROVIDER,
      [AccountProviderAttr.providerUserId]: clerkUserId,
      ...(email !== null ? { [AccountProviderAttr.email]: email } : {}),
      [AccountProviderAttr.linkedAt]: now,
      'patch/createdById': accountId,
    },
  };
  return [
    {
      entityId: accountId,
      entityType: ACCOUNT_ENTITY_TYPE,
      attributes: {
        [AccountAttr.id]: accountId,
        [AccountAttr.createdAt]: now,
        'patch/createdById': accountId,
      },
    },
    providerPatch,
  ];
}

async function ensureInternalAccountIdForClerkUser(args: {
  db: PatchDb;
  clerkUserId: string;
  email: string | null;
}): Promise<string> {
  const { db, clerkUserId, email } = args;
  const existing = await findClerkAccountProvider(db, clerkUserId);
  if (existing !== undefined) {
    const aid = existing.attributes[AccountProviderAttr.accountId];
    assert.string(aid, 'accountProvider must have accountId');
    assertUuid(aid, 'accountId must be UUID');
    return aid;
  }
  const accountId = crypto.randomUUID();
  const patches = patchesForNewClerkAccount({
    clerkUserId,
    email,
    accountId,
  });
  await db.write(patches, PATCHES_DB_SYSTEM_CONTEXT);
  return accountId;
}

/**
 * Clerk-backed account rows: maps external subject → internal UUID (creates on first sight).
 */
export class AccountProvisioningClerkAdapter implements AccountProvisioningPort {
  async resolveInternalAccountId({
    db,
    claims,
  }: Parameters<AccountProvisioningPort['resolveInternalAccountId']>[0]) {
    return await ensureInternalAccountIdForClerkUser({
      db,
      clerkUserId: claims.subject,
      email: claims.email,
    });
  }
}

export const clerkAccountProvisioning: AccountProvisioningPort =
  new AccountProvisioningClerkAdapter();
