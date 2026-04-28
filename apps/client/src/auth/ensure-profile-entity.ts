import {
  assertPrincipalId,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity, PatchesDb } from '@gamezilla/patch-db/interface';

function normString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

type ReadResult = {
  principalEntity: Entity | undefined;
  legacy: Entity | undefined;
  existingPointer: string | null;
};

async function readPrincipalAndLegacy(
  db: PatchesDb,
  principalId: string
): Promise<ReadResult> {
  const [principalBatch, legacyBatch] = await Promise.all([
    db.read([
      {
        entityType: PRINCIPAL_ENTITY_TYPE,
        entityId: principalId,
        limit: 1,
      },
    ]),
    db.read([
      {
        entityType: PROFILE_ENTITY_TYPE,
        entityId: principalId,
        limit: 1,
      },
    ]),
  ]);

  const principalEntity = principalBatch[0]?.entities[0];
  const legacy = legacyBatch[0]?.entities[0];
  const existingPointer = normString(
    principalEntity?.attributes[PrincipalAttr.currentProfileId]
  );

  return { principalEntity, legacy, existingPointer };
}

function buildNewProfileAttrs(
  principalId: string,
  newProfileId: string,
  legacy: Entity | undefined
): Record<string, unknown> {
  const now = new Date().toISOString();
  const attrs: Record<string, unknown> = {
    [ProfileAttr.id]: newProfileId,
    [ProfileAttr.createdAt]: now,
    [ProfileAttr.createdByPrincipalId]: principalId,
  };

  if (legacy === undefined) return attrs;

  const legacyAttrs = legacy.attributes as Record<string, unknown>;
  const dn = normString(legacyAttrs[ProfileAttr.displayName]);
  if (dn !== null) {
    attrs[ProfileAttr.displayName] = dn;
  }
  const cfg = legacyAttrs[ProfileAttr.avatarConfig];
  if (cfg !== undefined && cfg !== null) {
    attrs[ProfileAttr.avatarConfig] = cfg;
  }
  return attrs;
}

function buildMigrationWrites(
  principalId: string,
  newProfileId: string,
  legacy: Entity | undefined
): Parameters<PatchesDb['write']>[0] {
  const writes: Parameters<PatchesDb['write']>[0] = [
    {
      entityId: newProfileId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: buildNewProfileAttrs(principalId, newProfileId, legacy),
    },
    {
      entityId: principalId,
      entityType: PRINCIPAL_ENTITY_TYPE,
      attributes: { [PrincipalAttr.currentProfileId]: newProfileId },
    },
  ];

  if (legacy !== undefined) {
    writes.push({
      entityId: principalId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: { [ProfileAttr.deleted]: true },
    });
  }
  return writes;
}

async function softDeleteLegacyIfNeeded(
  db: PatchesDb,
  principalId: string,
  legacy: Entity | undefined
): Promise<void> {
  if (legacy === undefined) return;
  if (legacy.attributes[ProfileAttr.deleted] === true) return;
  await db.write([
    {
      entityId: principalId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: { [ProfileAttr.deleted]: true },
    },
  ]);
}

/**
 * Ensures this device has a `principal/currentProfileId` and a non-legacy profile row.
 * Migrates legacy `profile` rows where `entityId === principalId` into a UUID-backed row.
 */
export async function ensureProfileEntity(
  db: PatchesDb,
  principalId: string
): Promise<void> {
  assertPrincipalId(principalId);

  const { legacy, existingPointer } = await readPrincipalAndLegacy(
    db,
    principalId
  );

  if (existingPointer !== null) {
    await softDeleteLegacyIfNeeded(db, principalId, legacy);
    return;
  }

  const newProfileId = globalThis.crypto.randomUUID();
  await db.write(buildMigrationWrites(principalId, newProfileId, legacy));
}
