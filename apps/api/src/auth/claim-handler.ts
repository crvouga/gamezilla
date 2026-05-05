import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import { assertDeviceId, assertUuid } from '@gamezilla/domain/auth/device-id';
import { assert } from '@gamezilla/lib/assert';
import type {
  Entity,
  PatchDb,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import type { z } from 'zod';
import type { GoogleIdTokenClaims } from './google-token';
import { verifyGoogleIdToken as verifyGoogleIdTokenLive } from './google-token';
import type { authClaimRequestSchema } from './schema';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Returned when the Google Web client ID cannot be resolved from Doppler. */
export const GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE =
  'Google OAuth is not configured on this server';

export type ClaimRequestBody = z.infer<typeof authClaimRequestSchema>;

export type ClaimSuccessBody = {
  accountId: string;
  sessionToken: string;
  expiresAt: string;
  /** Same `entityId` as the server-written `accountSession` row (for local-first mirroring). */
  sessionEntityId: string;
};

export type AuthClaimErrorBody = { error: string };

export type AuthClaimResult =
  | { status: 200; json: ClaimSuccessBody }
  | { status: 400; json: AuthClaimErrorBody }
  | { status: 401; json: AuthClaimErrorBody }
  | { status: 503; json: AuthClaimErrorBody };

/** Production uses {@link verifyGoogleIdTokenLive}; tests pass a deterministic implementation. */
export type VerifyGoogleIdTokenFn = (
  idToken: string,
  options?: { expectedAudience?: string }
) => Promise<GoogleIdTokenClaims>;

export type HandleAuthClaimOptions = {
  googleClientId?: string;
  verifyGoogleIdToken?: VerifyGoogleIdTokenFn;
};

/**
 * Looks up an existing account provider row linked to this Google `sub`.
 */
async function findGoogleAccountProvider(
  db: PatchDb,
  providerUserId: string
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
              value: GOOGLE_PROVIDER,
            },
            {
              type: '=',
              attribute: AccountProviderAttr.providerUserId,
              value: providerUserId,
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

/**
 * Ensures an `account` + `accountProvider` exist for a first-time Google identity.
 * Returns `accountId` and patches to append (empty if provider already existed).
 */
function patchesForNewGoogleAccount(args: {
  claims: GoogleIdTokenClaims;
  accountId: string;
}): { accountId: string; patches: PatchInput[] } {
  const { claims, accountId } = args;
  const now = new Date().toISOString();
  const patches: PatchInput[] = [
    {
      entityId: accountId,
      entityType: ACCOUNT_ENTITY_TYPE,
      attributes: {
        [AccountAttr.id]: accountId,
        [AccountAttr.createdAt]: now,
        'patch/createdById': accountId,
      },
    },
    {
      entityId: crypto.randomUUID(),
      entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
      attributes: {
        [AccountProviderAttr.accountId]: accountId,
        [AccountProviderAttr.provider]: GOOGLE_PROVIDER,
        [AccountProviderAttr.providerUserId]: claims.sub,
        [AccountProviderAttr.email]: claims.email,
        [AccountProviderAttr.linkedAt]: now,
        'patch/createdById': accountId,
      },
    },
  ];
  return { accountId, patches };
}

/**
 * Resolves `accountId` from an existing provider row or creates account + accountProvider patches.
 */
async function resolveOrCreateAccountForGoogle(args: {
  db: PatchDb;
  claims: GoogleIdTokenClaims;
  patchesToWrite: PatchInput[];
}): Promise<string> {
  const { db, claims, patchesToWrite } = args;
  const existing = await findGoogleAccountProvider(db, claims.sub);
  if (existing !== undefined) {
    const aid = existing.attributes[AccountProviderAttr.accountId];
    assert.string(aid, 'accountProvider must have accountId');
    assertUuid(aid, 'accountId must be UUID');
    return aid;
  }
  const accountId = crypto.randomUUID();
  const { patches } = patchesForNewGoogleAccount({
    claims,
    accountId,
  });
  patchesToWrite.push(...patches);
  return accountId;
}

function appendSessionPatch(args: {
  deviceId: string;
  accountId: string;
  patchesToWrite: PatchInput[];
}): { sessionToken: string; expiresAt: string; sessionEntityId: string } {
  const { deviceId, accountId, patchesToWrite } = args;
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const sessionEntityId = crypto.randomUUID();
  const sessionCreatedAt = new Date().toISOString();

  patchesToWrite.push({
    entityId: sessionEntityId,
    entityType: ACCOUNT_SESSION_ENTITY_TYPE,
    attributes: {
      [AccountSessionAttr.deviceId]: deviceId,
      [AccountSessionAttr.accountId]: accountId,
      [AccountSessionAttr.token]: sessionToken,
      [AccountSessionAttr.expiresAt]: expiresAt,
      [AccountSessionAttr.createdAt]: sessionCreatedAt,
      'patch/createdById': accountId,
    },
  });
  return { sessionToken, expiresAt, sessionEntityId };
}

/**
 * Google OAuth claim: validates token, links account + accountSession. Typed for Hono RPC (`c.json`).
 */
export async function handleAuthClaimResult(
  db: PatchDb,
  body: ClaimRequestBody,
  options: HandleAuthClaimOptions = {}
): Promise<AuthClaimResult> {
  const googleClientId = options.googleClientId?.trim() ?? '';
  if (googleClientId.length === 0) {
    return {
      status: 503,
      json: { error: GOOGLE_OAUTH_NOT_CONFIGURED_MESSAGE },
    };
  }

  const { googleIdToken, deviceId } = body;
  assertDeviceId(deviceId);

  const verifyGoogleIdToken =
    options.verifyGoogleIdToken ?? verifyGoogleIdTokenLive;

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
    patchesToWrite,
  });

  const { sessionToken, expiresAt, sessionEntityId } = appendSessionPatch({
    deviceId,
    accountId,
    patchesToWrite,
  });

  await db.write(patchesToWrite, PATCHES_DB_SYSTEM_CONTEXT);

  const success: ClaimSuccessBody = {
    accountId,
    sessionToken,
    expiresAt,
    sessionEntityId,
  };
  return { status: 200, json: success };
}
