import {
  assertPrincipalId,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import { assert } from '@gamezilla/lib/assert';
import type { Entity, PatchesDb } from '@gamezilla/patch-db/interface';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

function normString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
  return null;
}

function androidVersionCodeString(raw: unknown): string | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
}

function resolveAppBuildNumber(): string | null {
  const iosBuild = Constants.expoConfig?.ios?.buildNumber;
  if (typeof iosBuild === 'string' && iosBuild.trim().length > 0) {
    return iosBuild.trim();
  }
  return androidVersionCodeString(Constants.expoConfig?.android?.versionCode);
}

function readWebUserAgent(): string | null {
  if (Platform.OS !== 'web') return null;
  if (typeof globalThis === 'undefined') return null;
  if (!('navigator' in globalThis) || globalThis.navigator === undefined) {
    return null;
  }
  if (typeof globalThis.navigator.userAgent !== 'string') return null;
  return normString(globalThis.navigator.userAgent);
}

function collectDeviceSnapshot(): Record<
  | typeof PrincipalAttr.platform
  | typeof PrincipalAttr.osName
  | typeof PrincipalAttr.osVersion
  | typeof PrincipalAttr.deviceModelName
  | typeof PrincipalAttr.deviceBrand
  | typeof PrincipalAttr.deviceName
  | typeof PrincipalAttr.appVersion
  | typeof PrincipalAttr.appBuildNumber
  | typeof PrincipalAttr.userAgent,
  string | null
> {
  return {
    [PrincipalAttr.platform]: Platform.OS,
    [PrincipalAttr.osName]: normString(Device.osName),
    [PrincipalAttr.osVersion]: normString(Device.osVersion),
    [PrincipalAttr.deviceModelName]: normString(Device.modelName),
    [PrincipalAttr.deviceBrand]: normString(Device.brand),
    [PrincipalAttr.deviceName]: normString(Constants.deviceName),
    [PrincipalAttr.appVersion]: normString(Constants.expoConfig?.version),
    [PrincipalAttr.appBuildNumber]: resolveAppBuildNumber(),
    [PrincipalAttr.userAgent]: readWebUserAgent(),
  };
}

function isPrincipalRowComplete(
  entity: Entity | undefined,
  principalId: string
): boolean {
  if (entity === undefined) return false;
  return (
    entity.attributes[PrincipalAttr.id] === principalId &&
    typeof entity.attributes[PrincipalAttr.createdAt] === 'string'
  );
}

function snapshotDiffers(
  stored: Record<string, unknown>,
  snapshot: ReturnType<typeof collectDeviceSnapshot>,
  key: keyof ReturnType<typeof collectDeviceSnapshot>
): boolean {
  const prev = normString(stored[key]);
  const next = snapshot[key];
  if (prev === null && next === null) return false;
  if (prev === null || next === null) return prev !== next;
  return prev !== next;
}

/**
 * Ensures a `principal` entity exists locally with id + createdAt (first launch),
 * then on every launch refreshes `lastSeenAt` and any changed device metadata.
 */
export async function ensurePrincipalEntity(
  db: PatchesDb,
  principalId: string
): Promise<void> {
  assertPrincipalId(principalId);

  const [res] = await db.read([
    {
      entityType: PRINCIPAL_ENTITY_TYPE,
      entityId: principalId,
      limit: 1,
    },
  ]);
  const entity = res?.entities[0];
  const now = new Date().toISOString();
  const snapshot = collectDeviceSnapshot();

  if (!isPrincipalRowComplete(entity, principalId)) {
    const attributes: Record<string, unknown> = {
      [PrincipalAttr.id]: principalId,
      [PrincipalAttr.createdAt]: now,
      [PrincipalAttr.firstSeenAt]: now,
      [PrincipalAttr.lastSeenAt]: now,
    };
    for (const [k, v] of Object.entries(snapshot)) {
      if (v !== null) {
        attributes[k] = v;
      }
    }
    await db.write([
      {
        entityId: principalId,
        entityType: PRINCIPAL_ENTITY_TYPE,
        attributes,
      },
    ]);
    return;
  }

  assert.ok(
    entity !== undefined,
    'principal entity must exist after completeness check'
  );
  const stored = entity.attributes;
  const updates: Record<string, unknown> = {
    [PrincipalAttr.lastSeenAt]: now,
  };

  const existingFirst = normString(stored[PrincipalAttr.firstSeenAt]);
  if (existingFirst === null) {
    const created = normString(stored[PrincipalAttr.createdAt]);
    updates[PrincipalAttr.firstSeenAt] = created !== null ? created : now;
  }

  for (const key of Object.keys(snapshot) as (keyof ReturnType<
    typeof collectDeviceSnapshot
  >)[]) {
    const next = snapshot[key];
    if (next === null) continue;
    if (snapshotDiffers(stored, snapshot, key)) {
      updates[key] = next;
    }
  }

  await db.write([
    {
      entityId: principalId,
      entityType: PRINCIPAL_ENTITY_TYPE,
      attributes: updates,
    },
  ]);
}
