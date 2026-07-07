import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
} from '@libs/auth/shared';
import { assertUuid } from '@libs/auth/shared/device-id';
import { assert } from '@pkgs/assert';
import type { Entity, PatchDb, PatchInput } from '@pkgs/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@pkgs/patch-db/interface';
import { PatchMetaAttr } from '@pkgs/patch-db/metadata/patch-metadata';

async function findAuthAccountProvider(
  db: PatchDb,
  provider: string,
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
              value: provider,
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
  provider: string;
}): PatchInput[] {
  const { externalUserId, email, accountId, provider } = args;
  const now = new Date().toISOString();
  const providerPatch: PatchInput = {
    entityId: crypto.randomUUID(),
    entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
    attributes: {
      ...AccountProviderAttr.accountId(accountId),
      ...AccountProviderAttr.provider(provider),
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

export async function ensureInternalAccountIdForExternalUser(args: {
  db: PatchDb;
  externalUserId: string;
  email: string | null;
  provider: string;
}): Promise<string> {
  const { db, externalUserId, email, provider } = args;
  const existing = await findAuthAccountProvider(db, provider, externalUserId);
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
    provider,
  });
  await db.write(patches, PATCHES_DB_SYSTEM_CONTEXT);
  return accountId;
}
