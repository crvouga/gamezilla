import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { DeviceAttr } from '../shared/auth-entities';

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

function put(
  attrs: Record<string, string>,
  key: string,
  value: string | null
): void {
  if (value !== null) attrs[key] = value;
}

/**
 * Best-effort device metadata for the current install, keyed directly by the
 * `device/...` PatchDB attribute names. Sent verbatim to `POST /auth/refresh`,
 * which merges the record into `device/<deviceId>` without any field-name
 * remapping. Null / empty values are omitted so the wire payload stays minimal.
 */
export function collectDeviceSnapshot(): Record<string, string> {
  const attrs: Record<string, string> = {};
  put(attrs, DeviceAttr.platform.key, Platform.OS);
  put(attrs, DeviceAttr.osName.key, normString(Device.osName));
  put(attrs, DeviceAttr.osVersion.key, normString(Device.osVersion));
  put(attrs, DeviceAttr.deviceModelName.key, normString(Device.modelName));
  put(attrs, DeviceAttr.deviceBrand.key, normString(Device.brand));
  put(attrs, DeviceAttr.deviceName.key, normString(Constants.deviceName));
  put(
    attrs,
    DeviceAttr.appVersion.key,
    normString(Constants.expoConfig?.version)
  );
  put(attrs, DeviceAttr.appBuildNumber.key, resolveAppBuildNumber());
  put(attrs, DeviceAttr.userAgent.key, readWebUserAgent());
  return attrs;
}
