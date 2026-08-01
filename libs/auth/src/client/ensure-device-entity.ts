import { DeviceCol, DEVICES_TABLE } from '@libs/db/shared/auth-tables';
import { AUTH_RULES } from '@pkgs/rules/auth/rules';
import type { RulesAuth } from '@pkgs/rules/core/types';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { validatedWrite } from '@pkgs/sync-engine-powersync/client/validated-write';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { assertDeviceId } from '../shared';
import {
  ensureDeviceRow,
  type DeviceSnapshot,
} from '../shared/writes/ensure-device-write';

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

/** Collects expo/platform device metadata; stays CLIENT-only. */
export function collectDeviceSnapshot(): DeviceSnapshot {
  return {
    [DeviceCol.platform]: Platform.OS,
    [DeviceCol.osName]: normString(Device.osName),
    [DeviceCol.osVersion]: normString(Device.osVersion),
    [DeviceCol.deviceModelName]: normString(Device.modelName),
    [DeviceCol.deviceBrand]: normString(Device.brand),
    [DeviceCol.deviceName]: normString(Constants.deviceName),
    [DeviceCol.appVersion]: normString(Constants.expoConfig?.version),
    [DeviceCol.appBuildNumber]: resolveAppBuildNumber(),
    [DeviceCol.userAgent]: readWebUserAgent(),
  };
}

/**
 * Ensures a `devices` row exists locally with id + created_at (first launch),
 * then on every launch refreshes `last_seen_at` and any changed device metadata.
 */
export async function ensureDeviceEntity(
  sql: SqlClient,
  auth: RulesAuth,
  deviceId: string = auth.deviceId
): Promise<void> {
  assertDeviceId(deviceId);
  const snapshot = collectDeviceSnapshot();
  await validatedWrite({
    sql,
    auth,
    rules: AUTH_RULES,
    beforeBatch: {
      rows: [
        {
          op: 'put',
          table: DEVICES_TABLE.tableName,
          id: deviceId,
          values: { id: deviceId },
        },
      ],
    },
    fn: (tx) => ensureDeviceRow(tx, deviceId, snapshot),
  });
}
