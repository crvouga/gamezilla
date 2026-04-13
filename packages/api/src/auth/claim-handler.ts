import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
  PRINCIPAL_ENTITY_TYPE,
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalAttr,
  PrincipalSessionAttr,
} from '@gamezilla/shared/auth';
import { assertPrincipalId, assertUuid } from '@gamezilla/shared/auth/principal-id';
import { assert } from '@gamezilla/shared/assert';
import type { PatchInput, PatchesDb } from '@gamezilla/patch-db/interface';
import { verifyGoogleIdToken } from './google-token';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ClaimRequestBody = {
  googleIdToken: string;
  principalId: string;
};

export type ClaimSuccessBody = {
  accountId: string;
  sessionToken: string;
  expiresAt: string;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleAuthClaim(
  db: PatchesDb,
  body: unknown,
  options: { googleClientId?: string }
): Promise<Response> {
  assert.record(body, 'claim body must be object');
  const googleIdToken = body['googleIdToken'];
  const principalId = body['principalId'];
  assert.string(googleIdToken, 'googleIdToken must be string');
  assert.string(principalId, 'principalId must be string');
  assertPrincipalId(principalId);

  let claims;
  try {
    const verifyOpts =
      options.googleClientId !== undefined && options.googleClientId.length > 0
        ? { expectedAudience: options.googleClientId }
        : {};
    claims = await verifyGoogleIdToken(googleIdToken, verifyOpts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 401);
  }

  const providerAccountId = claims.sub;
  const email = claims.email;

  const [providerResult] = await db.read([
    {
      entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
      where: {
        type: 'and',
        clauses: [
          {
            type: '=',
            attribute: AccountProviderAttr.provider,
            value: GOOGLE_PROVIDER,
          },
          {
            type: '=',
            attribute: AccountProviderAttr.providerAccountId,
            value: providerAccountId,
          },
        ],
      },
      limit: 1,
    },
  ]);

  let accountId: string;
  const existingProvider = providerResult?.entities[0];
  const patchesToWrite: PatchInput[] = [];

  if (existingProvider !== undefined) {
    const aid = existingProvider.attributes[AccountProviderAttr.accountId];
    assert.string(aid, 'accountProvider must have accountId');
    assertUuid(aid, 'accountId must be UUID');
    accountId = aid;
  } else {
    accountId = crypto.randomUUID();
    const now = new Date().toISOString();
    patchesToWrite.push(
      {
        entityId: accountId,
        entityType: ACCOUNT_ENTITY_TYPE,
        attributes: {
          [AccountAttr.id]: accountId,
          [AccountAttr.createdAt]: now,
          'patch/createdBy': principalId,
        },
      },
      {
        entityId: crypto.randomUUID(),
        entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
        attributes: {
          [AccountProviderAttr.accountId]: accountId,
          [AccountProviderAttr.provider]: GOOGLE_PROVIDER,
          [AccountProviderAttr.providerAccountId]: providerAccountId,
          [AccountProviderAttr.email]: email,
          [AccountProviderAttr.linkedAt]: now,
          'patch/createdBy': principalId,
        },
      }
    );
  }

  const [principalResult] = await db.read([
    {
      entityType: PRINCIPAL_ENTITY_TYPE,
      entityId: principalId,
      limit: 1,
    },
  ]);

  const principalEntity = principalResult?.entities[0];
  const existingAccountId = principalEntity?.attributes[PrincipalAttr.accountId];

  if (
    existingAccountId !== undefined &&
    existingAccountId !== null &&
    typeof existingAccountId === 'string' &&
    existingAccountId !== accountId
  ) {
    return jsonResponse(
      {
        error: 'principal already claimed by a different account',
      },
      409
    );
  }

  const idempotentSameAccount =
    typeof existingAccountId === 'string' &&
    existingAccountId === accountId;

  if (!idempotentSameAccount) {
    patchesToWrite.push({
      entityId: principalId,
      entityType: PRINCIPAL_ENTITY_TYPE,
      attributes: {
        [PrincipalAttr.accountId]: accountId,
        'patch/createdBy': principalId,
      },
    });
  }

  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const sessionEntityId = crypto.randomUUID();
  const sessionCreatedAt = new Date().toISOString();

  patchesToWrite.push({
    entityId: sessionEntityId,
    entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
    attributes: {
      [PrincipalSessionAttr.principalId]: principalId,
      [PrincipalSessionAttr.accountId]: accountId,
      [PrincipalSessionAttr.token]: sessionToken,
      [PrincipalSessionAttr.expiresAt]: expiresAt,
      [PrincipalSessionAttr.createdAt]: sessionCreatedAt,
      'patch/createdBy': principalId,
    },
  });

  await db.write(patchesToWrite);

  const success: ClaimSuccessBody = { accountId, sessionToken, expiresAt };
  return jsonResponse(success, 200);
}
