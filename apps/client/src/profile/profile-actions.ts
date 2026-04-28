import {
  ACCOUNT_ENTITY_TYPE,
  AccountAttr,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { PatchesDb } from '@gamezilla/patch-db/interface';

export type ProfileActionContext = {
  principalId: string;
  accountId: string | null;
};

function normString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function isProfileDeleted(attrs: Record<string, unknown>): boolean {
  return attrs[ProfileAttr.deleted] === true;
}

/**
 * Creates a new profile row and optionally sets it as current on principal + account.
 */
export async function createProfile(
  db: PatchesDb,
  ctx: ProfileActionContext,
  args?: {
    displayName?: string;
    avatarConfig?: unknown;
    /** When true (default), updates principal/account current pointers to the new profile. */
    setAsCurrent?: boolean;
  }
): Promise<string> {
  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();
  const attrs: Record<string, unknown> = {
    [ProfileAttr.id]: id,
    [ProfileAttr.createdAt]: now,
    [ProfileAttr.createdByPrincipalId]: ctx.principalId,
  };
  const displayName = args?.displayName?.trim();
  if (displayName !== undefined && displayName.length > 0) {
    attrs[ProfileAttr.displayName] = displayName;
  }
  if (args?.avatarConfig !== undefined) {
    attrs[ProfileAttr.avatarConfig] = args.avatarConfig;
  }
  await db.write([
    {
      entityId: id,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: attrs,
    },
  ]);
  const setAsCurrent = args?.setAsCurrent !== false;
  if (setAsCurrent) {
    await switchProfile(db, id, ctx);
  }
  return id;
}

/**
 * Sets `principal/currentProfileId` and, when signed in, `account/currentProfileId`.
 */
export async function switchProfile(
  db: PatchesDb,
  profileId: string,
  ctx: ProfileActionContext
): Promise<void> {
  const patches: Parameters<PatchesDb['write']>[0] = [
    {
      entityId: ctx.principalId,
      entityType: PRINCIPAL_ENTITY_TYPE,
      attributes: { [PrincipalAttr.currentProfileId]: profileId },
    },
  ];
  if (ctx.accountId !== null) {
    patches.push({
      entityId: ctx.accountId,
      entityType: ACCOUNT_ENTITY_TYPE,
      attributes: { [AccountAttr.currentProfileId]: profileId },
    });
  }
  await db.write(patches);
}

async function readFirstNonDeletedProfileId(
  db: PatchesDb,
  excludeId: string
): Promise<string | null> {
  const [res] = await db.read([
    {
      entityType: PROFILE_ENTITY_TYPE,
      where: { type: 'not_exists', attribute: ProfileAttr.deleted },
      limit: 200,
    },
  ]);
  for (const e of res?.entities ?? []) {
    if (e.entityId === excludeId) continue;
    if (isProfileDeleted(e.attributes as Record<string, unknown>)) continue;
    return e.entityId;
  }
  return null;
}

async function readCurrentPointers(
  db: PatchesDb,
  ctx: ProfileActionContext
): Promise<{ principalPtr: string | null; accountPtr: string | null }> {
  const [principalRes] = await db.read([
    {
      entityType: PRINCIPAL_ENTITY_TYPE,
      entityId: ctx.principalId,
      limit: 1,
    },
  ]);
  const principalPtr = normString(
    principalRes?.entities[0]?.attributes[PrincipalAttr.currentProfileId]
  );

  if (ctx.accountId === null) {
    return { principalPtr, accountPtr: null };
  }
  const [acctRes] = await db.read([
    {
      entityType: ACCOUNT_ENTITY_TYPE,
      entityId: ctx.accountId,
      limit: 1,
    },
  ]);
  const accountPtr = normString(
    acctRes?.entities[0]?.attributes[AccountAttr.currentProfileId]
  );
  return { principalPtr, accountPtr };
}

function buildClearCurrentPatches(
  ctx: ProfileActionContext,
  wasPrincipalCurrent: boolean,
  wasAccountCurrent: boolean
): Parameters<PatchesDb['write']>[0] {
  const patches: Parameters<PatchesDb['write']>[0] = [];
  if (wasPrincipalCurrent) {
    patches.push({
      entityId: ctx.principalId,
      entityType: PRINCIPAL_ENTITY_TYPE,
      attributes: { [PrincipalAttr.currentProfileId]: null },
    });
  }
  if (wasAccountCurrent && ctx.accountId !== null) {
    patches.push({
      entityId: ctx.accountId,
      entityType: ACCOUNT_ENTITY_TYPE,
      attributes: { [AccountAttr.currentProfileId]: null },
    });
  }
  return patches;
}

/**
 * Soft-deletes a profile. If it was the current profile, switches to another
 * non-deleted profile or clears pointers when none remain.
 */
export async function deleteProfile(
  db: PatchesDb,
  profileId: string,
  ctx: ProfileActionContext
): Promise<void> {
  const { principalPtr, accountPtr } = await readCurrentPointers(db, ctx);
  const wasPrincipalCurrent = principalPtr === profileId;
  const wasAccountCurrent = accountPtr === profileId;

  const alternateId = await readFirstNonDeletedProfileId(db, profileId);

  await db.write([
    {
      entityId: profileId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: { [ProfileAttr.deleted]: true },
    },
  ]);

  if (!wasPrincipalCurrent && !wasAccountCurrent) return;
  if (alternateId !== null) {
    await switchProfile(db, alternateId, ctx);
    return;
  }

  const clearPatches = buildClearCurrentPatches(
    ctx,
    wasPrincipalCurrent,
    wasAccountCurrent
  );
  if (clearPatches.length > 0) {
    await db.write(clearPatches);
  }
}
