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
} from '@gamezilla/domain/auth';
import { assertPrincipalId, assertUuid } from '@gamezilla/domain/auth/principal-id';
import { assert } from '@gamezilla/lib/assert';
import type { Entity, PatchInput, PatchesDb } from '@gamezilla/patch-db/interface';
import type { z } from 'zod';
import { authClaimRequestSchema } from './schema';
import type { GoogleIdTokenClaims } from './google-token';
import { verifyGoogleIdToken } from './google-token';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Returned when the Google Web client ID cannot be resolved from Doppler. */
export const GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE =
  'Google OAuth is not configured on this server';

export type ClaimRequestBody = z.infer<typeof authClaimRequestSchema>;

export type ClaimSuccessBody = {
  accountId: string;
  sessionToken: string;
  expiresAt: string;
};

export type AuthClaimErrorBody = { error: string };

export type AuthClaimResult =
  | { status: 200; json: ClaimSuccessBody }
  | { status: 400; json: AuthClaimErrorBody }
  | { status: 401; json: AuthClaimErrorBody }
  | { status: 503; json: AuthClaimErrorBody };

/**
 * Looks up an existing account linked to this Google `sub`.
 */
async function findGoogleAccountProvider(
  db: PatchesDb,
  providerAccountId: string
): Promise<Entity | undefined> {
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
  return providerResult?.entities[0];
}

/**
 * Ensures an `account` + `accountProvider` exist for a first-time Google identity.
 * Returns `accountId` and patches to append (empty if provider already existed).
 */
function patchesForNewGoogleAccount(args: {
  claims: GoogleIdTokenClaims;
  principalId: string;
}): { accountId: string; patches: PatchInput[] } {
  const { claims, principalId } = args;
  const accountId = crypto.randomUUID();
  const now = new Date().toISOString();
  const patches: PatchInput[] = [
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
        [AccountProviderAttr.providerAccountId]: claims.sub,
        [AccountProviderAttr.email]: claims.email,
        [AccountProviderAttr.linkedAt]: now,
        'patch/createdBy': principalId,
      },
    },
  ];
  return { accountId, patches };
}

/**
 * Resolves `accountId` from an existing provider row or creates account + provider patches.
 */
async function resolveOrCreateAccountForGoogle(args: {
  db: PatchesDb;
  claims: GoogleIdTokenClaims;
  principalId: string;
  patchesToWrite: PatchInput[];
}): Promise<string> {
  const { db, claims, principalId, patchesToWrite } = args;
  const existing = await findGoogleAccountProvider(db, claims.sub);
  if (existing !== undefined) {
    const aid = existing.attributes[AccountProviderAttr.accountId];
    assert.string(aid, 'accountProvider must have accountId');
    assertUuid(aid, 'accountId must be UUID');
    return aid;
  }
  const { accountId, patches } = patchesForNewGoogleAccount({
    claims,
    principalId,
  });
  patchesToWrite.push(...patches);
  return accountId;
}

async function readPrincipal(
  db: PatchesDb,
  principalId: string
): Promise<Entity | undefined> {
  const [principalResult] = await db.read([
    {
      entityType: PRINCIPAL_ENTITY_TYPE,
      entityId: principalId,
      limit: 1,
    },
  ]);
  return principalResult?.entities[0];
}

/**
 * Appends a patch binding `principalId` to `accountId`, rebinding if the principal
 * is already pointing at a different account.
 *
 * Local-first rationale: the principal is the durable per-device identity that owns
 * its authored patches (`patch/createdBy`). An account is server-side metadata that
 * opts the principal into cross-device sync. A fresh, verified Google id_token
 * expresses the user's *current* intent for which account this device should sync
 * under, so the latest sign-in wins. Refusing the rebind would force users to
 * reinstall to switch Google accounts on the same device (and would also surface
 * spuriously after dev DB resets, when the principal's stale accountId no longer
 * resolves to a real account on the server).
 */
function appendPrincipalBindingIfNeeded(args: {
  principalId: string;
  accountId: string;
  principalEntity: Entity | undefined;
  patchesToWrite: PatchInput[];
}): void {
  const { principalId, accountId, principalEntity, patchesToWrite } = args;
  const existingAccountId = principalEntity?.attributes[PrincipalAttr.accountId];

  const alreadyBoundToSameAccount =
    typeof existingAccountId === 'string' && existingAccountId === accountId;
  if (alreadyBoundToSameAccount) {
    return;
  }

  patchesToWrite.push({
    entityId: principalId,
    entityType: PRINCIPAL_ENTITY_TYPE,
    attributes: {
      [PrincipalAttr.accountId]: accountId,
      'patch/createdBy': principalId,
    },
  });
}

function appendSessionPatch(args: {
  principalId: string;
  accountId: string;
  patchesToWrite: PatchInput[];
}): { sessionToken: string; expiresAt: string } {
  const { principalId, accountId, patchesToWrite } = args;
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
  return { sessionToken, expiresAt };
}

/**
 * Google OAuth claim: validates token, links account + session. Typed for Hono RPC (`c.json`).
 */
export async function handleAuthClaimResult(
  db: PatchesDb,
  body: ClaimRequestBody,
  options: { googleClientId?: string }
): Promise<AuthClaimResult> {
  const googleClientId = options.googleClientId?.trim() ?? '';
  if (googleClientId.length === 0) {
    return {
      status: 503,
      json: { error: GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE },
    };
  }

  const { googleIdToken, principalId } = body;
  assertPrincipalId(principalId);

  let claims: GoogleIdTokenClaims;
  try {
    claims = await verifyGoogleIdToken(googleIdToken, {
      expectedAudience: googleClientId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 401, json: { error: message } };
  }

  const patchesToWrite: PatchInput[] = [];

  const accountId = await resolveOrCreateAccountForGoogle({
    db,
    claims,
    principalId,
    patchesToWrite,
  });

  const principalEntity = await readPrincipal(db, principalId);
  appendPrincipalBindingIfNeeded({
    principalId,
    accountId,
    principalEntity,
    patchesToWrite,
  });

  const { sessionToken, expiresAt } = appendSessionPatch({
    principalId,
    accountId,
    patchesToWrite,
  });

  await db.write(patchesToWrite);

  const success: ClaimSuccessBody = { accountId, sessionToken, expiresAt };
  return { status: 200, json: success };
}
