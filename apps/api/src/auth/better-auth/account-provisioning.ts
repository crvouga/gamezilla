import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
} from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/device-id';
import { assert } from '@gamezilla/lib/assert';
import type {
  Entity,
  PatchDb,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import { PatchMetaAttr } from '@gamezilla/patch-db/metadata/patch-metadata';
import type { AccountProvisioningPort } from '../ports';

/** Stored in {@link AccountProviderAttr.provider} — only referenced inside this adapter. */
const INTERNAL_AUTH_PROVIDER = 'better-auth' as const;

async function findAuthAccountProvider(
  db: PatchDb,
  externalUserId: string
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
              attribute: AccountProviderAttr.provider.key,
              value: INTERNAL_AUTH_PROVIDER,
            },
            {
              type: '=',
              attribute: AccountProviderAttr.providerUserId.key,
              value: externalUserId,
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

function patchesForNewAuthUserAccount(args: {
  externalUserId: string;
  email: string | null;
  accountId: string;
}): PatchInput[] {
  const { externalUserId, email, accountId } = args;
  const now = new Date().toISOString();
  const providerPatch: PatchInput = {
    entityId: crypto.randomUUID(),
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    attributes: {
      ...AccountProviderAttr.accountId(accountId),
      ...AccountProviderAttr.provider(INTERNAL_AUTH_PROVIDER),
      ...AccountProviderAttr.providerUserId(externalUserId),
      ...(email !== null ? AccountProviderAttr.email(email) : {}),
      ...AccountProviderAttr.linkedAt(now),
      ...PatchMetaAttr.createdById(accountId),
    },
  };
  return [
    {
      entityId: accountId,
      entityType: ACCOUNT_ENTITY_TYPE,
      attributes: {
        ...AccountAttr.id(accountId),
        ...AccountAttr.createdAt(now),
        ...PatchMetaAttr.createdById(accountId),
      },
    },
    providerPatch,
  ];
}

async function ensureInternalAccountIdForExternalUser(args: {
  db: PatchDb;
  externalUserId: string;
  email: string | null;
}): Promise<string> {
  const { db, externalUserId, email } = args;
  const existing = await findAuthAccountProvider(db, externalUserId);
  if (existing !== undefined) {
    const aid = existing.attributes[AccountProviderAttr.accountId.key];
    assert.string(aid, 'accountProvider must have accountId');
    assertUuid(aid, 'accountId must be UUID');
    return aid;
  }
  const accountId = crypto.randomUUID();
  const patches = patchesForNewAuthUserAccount({
    externalUserId,
    email,
    accountId,
  });
  await db.write(patches, PATCHES_DB_SYSTEM_CONTEXT);
  return accountId;
}

export class AccountProvisioningBetterAuthAdapter implements AccountProvisioningPort {
  async resolveInternalAccountId({
    db,
    claims,
  }: Parameters<AccountProvisioningPort['resolveInternalAccountId']>[0]) {
    return await ensureInternalAccountIdForExternalUser({
      db,
      externalUserId: claims.subject,
      email: claims.email,
    });
  }
}

export const betterAuthAccountProvisioning: AccountProvisioningPort =
  new AccountProvisioningBetterAuthAdapter();
