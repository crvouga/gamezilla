import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
  DEVICE_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  DeviceAttr,
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
  deviceId: string;
}): { accountId: string; patches: PatchInput[] } {
  const { claims, deviceId } = args;
  const accountId = crypto.randomUUID();
  const now = new Date().toISOString();
  const patches: PatchInput[] = [
    {
      entityId: accountId,
      entityType: ACCOUNT_ENTITY_TYPE,
      attributes: {
        [AccountAttr.id]: accountId,
        [AccountAttr.createdAt]: now,
        'patch/createdBy': deviceId,
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
        'patch/createdBy': deviceId,
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
  deviceId: string;
  patchesToWrite: PatchInput[];
}): Promise<string> {
  const { db, claims, deviceId, patchesToWrite } = args;
  const existing = await findGoogleAccountProvider(db, claims.sub);
  if (existing !== undefined) {
    const aid = existing.attributes[AccountProviderAttr.accountId];
    assert.string(aid, 'accountProvider must have accountId');
    assertUuid(aid, 'accountId must be UUID');
    return aid;
  }
  const { accountId, patches } = patchesForNewGoogleAccount({
    claims,
    deviceId,
  });
  patchesToWrite.push(...patches);
  return accountId;
}

async function readDeviceEntity(
  db: PatchDb,
  deviceId: string
): Promise<Entity | undefined> {
  const [deviceResult] = await db.read(
    [
      {
        entityType: DEVICE_ENTITY_TYPE,
        entityId: deviceId,
        limit: 1,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return deviceResult?.entities[0];
}

/**
 * Appends a patch binding `deviceId` to `accountId`, rebinding if the device row
 * is already pointing at a different account.
 *
 * Local-first rationale: the device is the durable per-install identity that owns
 * its authored patches (`patch/createdBy`). The account is server-side identity that
 * opts the device into cross-device sync. A fresh, verified Google id_token
 * expresses the account holder's *current* intent for which account this device should sync
 * under, so the latest sign-in wins. Refusing the rebind would force people to
 * reinstall to switch Google sign-in on the same install (and would also surface
 * spuriously after dev DB resets, when stale `device/accountId` no longer
 * resolves to a real account on the server).
 */
function appendAccountBindingOnDeviceIfNeeded(args: {
  deviceId: string;
  accountId: string;
  deviceEntity: Entity | undefined;
  patchesToWrite: PatchInput[];
}): void {
  const { deviceId, accountId, deviceEntity, patchesToWrite } = args;
  const existingAccountId = deviceEntity?.attributes[DeviceAttr.accountId];

  const alreadyBoundToSameAccount =
    typeof existingAccountId === 'string' && existingAccountId === accountId;
  if (alreadyBoundToSameAccount) {
    return;
  }

  patchesToWrite.push({
    entityId: deviceId,
    entityType: DEVICE_ENTITY_TYPE,
    attributes: {
      [DeviceAttr.accountId]: accountId,
      'patch/createdBy': deviceId,
    },
  });
}

function appendSessionPatch(args: {
  deviceId: string;
  accountId: string;
  patchesToWrite: PatchInput[];
}): { sessionToken: string; expiresAt: string } {
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
      'patch/createdBy': deviceId,
    },
  });
  return { sessionToken, expiresAt };
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
    deviceId,
    patchesToWrite,
  });

  const deviceEntity = await readDeviceEntity(db, deviceId);
  appendAccountBindingOnDeviceIfNeeded({
    deviceId,
    accountId,
    deviceEntity,
    patchesToWrite,
  });

  const { sessionToken, expiresAt } = appendSessionPatch({
    deviceId,
    accountId,
    patchesToWrite,
  });

  await db.write(patchesToWrite, PATCHES_DB_SYSTEM_CONTEXT);

  const success: ClaimSuccessBody = { accountId, sessionToken, expiresAt };
  return { status: 200, json: success };
}
