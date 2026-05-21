import { assertDeviceId, DEVICE_ENTITY_TYPE, DeviceAttr } from '../shared';
import { assert } from '@pkgs/assert';
import type { Entity, PatchDb } from '@pkgs/patch-db/interface';
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

function collectDeviceSnapshot(): Record<string, string | null> {
  return {
    [DeviceAttr.platform.key]: Platform.OS,
    [DeviceAttr.osName.key]: normString(Device.osName),
    [DeviceAttr.osVersion.key]: normString(Device.osVersion),
    [DeviceAttr.deviceModelName.key]: normString(Device.modelName),
    [DeviceAttr.deviceBrand.key]: normString(Device.brand),
    [DeviceAttr.deviceName.key]: normString(Constants.deviceName),
    [DeviceAttr.appVersion.key]: normString(Constants.expoConfig?.version),
    [DeviceAttr.appBuildNumber.key]: resolveAppBuildNumber(),
    [DeviceAttr.userAgent.key]: readWebUserAgent(),
  };
}

function isDeviceEntityComplete(
  entity: Entity | undefined,
  deviceId: string
): boolean {
  if (entity === undefined) return false;
  return (
    entity.attributes[DeviceAttr.id.key] === deviceId &&
    typeof entity.attributes[DeviceAttr.createdAt.key] === 'string'
  );
}

function snapshotDiffers(
  stored: Record<string, unknown>,
  snapshot: ReturnType<typeof collectDeviceSnapshot>,
  key: string
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
    const snapshotPatches = Object.entries(snapshot)
      .filter((entry): entry is [string, string] => entry[1] !== null)
      .map(([k, v]) => ({ [k]: v }));
    const attributes = {
      ...DeviceAttr.id(deviceId),
      ...DeviceAttr.createdAt(now),
      ...DeviceAttr.firstSeenAt(now),
      ...DeviceAttr.lastSeenAt(now),
      ...Object.assign({}, ...snapshotPatches),
    };
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
  const existingFirst = normString(stored[DeviceAttr.firstSeenAt.key]);
  const created = normString(stored[DeviceAttr.createdAt.key]);
  let updates = {
    ...DeviceAttr.lastSeenAt(now),
    ...(existingFirst === null
      ? DeviceAttr.firstSeenAt(created !== null ? created : now)
      : {}),
  };

  for (const key of Object.keys(snapshot)) {
    const next = snapshot[key];
    if (next === null) continue;
    if (snapshotDiffers(stored, snapshot, key)) {
      updates = { ...updates, [key]: next };
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
