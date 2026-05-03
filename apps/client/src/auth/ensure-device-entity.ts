import {
  assertDeviceId,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/domain/auth';
import { assert } from '@gamezilla/lib/assert';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';
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
  | typeof DeviceAttr.platform
  | typeof DeviceAttr.osName
  | typeof DeviceAttr.osVersion
  | typeof DeviceAttr.deviceModelName
  | typeof DeviceAttr.deviceBrand
  | typeof DeviceAttr.deviceName
  | typeof DeviceAttr.appVersion
  | typeof DeviceAttr.appBuildNumber
  | typeof DeviceAttr.userAgent,
  string | null
> {
  return {
    [DeviceAttr.platform]: Platform.OS,
    [DeviceAttr.osName]: normString(Device.osName),
    [DeviceAttr.osVersion]: normString(Device.osVersion),
    [DeviceAttr.deviceModelName]: normString(Device.modelName),
    [DeviceAttr.deviceBrand]: normString(Device.brand),
    [DeviceAttr.deviceName]: normString(Constants.deviceName),
    [DeviceAttr.appVersion]: normString(Constants.expoConfig?.version),
    [DeviceAttr.appBuildNumber]: resolveAppBuildNumber(),
    [DeviceAttr.userAgent]: readWebUserAgent(),
  };
}

function isDeviceEntityComplete(
  entity: Entity | undefined,
  deviceId: string
): boolean {
  if (entity === undefined) return false;
  return (
    entity.attributes[DeviceAttr.id] === deviceId &&
    typeof entity.attributes[DeviceAttr.createdAt] === 'string'
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
 * Ensures a `device` entity exists locally with id + createdAt (first launch),
 * then on every launch refreshes `lastSeenAt` and any changed device metadata.
 */
export async function ensureDeviceEntity(
  db: PatchDb,
  deviceId: string
): Promise<void> {
  assertDeviceId(deviceId);

  const [res] = await db.read([
    {
      entityType: DEVICE_ENTITY_TYPE,
      entityId: deviceId,
      limit: 1,
    },
  ]);
  const entity = res?.entities[0];
  const now = new Date().toISOString();
  const snapshot = collectDeviceSnapshot();

  if (!isDeviceEntityComplete(entity, deviceId)) {
    const attributes: Record<string, unknown> = {
      [DeviceAttr.id]: deviceId,
      [DeviceAttr.createdAt]: now,
      [DeviceAttr.firstSeenAt]: now,
      [DeviceAttr.lastSeenAt]: now,
    };
    for (const [k, v] of Object.entries(snapshot)) {
      if (v !== null) {
        attributes[k] = v;
      }
    }
    await db.write([
      {
        entityId: deviceId,
        entityType: DEVICE_ENTITY_TYPE,
        attributes,
      },
    ]);
    return;
  }

  assert.ok(
    entity !== undefined,
    'device entity must exist after completeness check'
  );
  const stored = entity.attributes;
  const updates: Record<string, unknown> = {
    [DeviceAttr.lastSeenAt]: now,
  };

  const existingFirst = normString(stored[DeviceAttr.firstSeenAt]);
  if (existingFirst === null) {
    const created = normString(stored[DeviceAttr.createdAt]);
    updates[DeviceAttr.firstSeenAt] = created !== null ? created : now;
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
      entityId: deviceId,
      entityType: DEVICE_ENTITY_TYPE,
      attributes: updates,
    },
  ]);
}
