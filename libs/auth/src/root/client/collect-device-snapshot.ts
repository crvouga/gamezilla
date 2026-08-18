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

function put(
  attrs: Record<string, string>,
  key: string,
  value: string | null
): void {
  if (value !== null) attrs[key] = value;
}

/**
 * Best-effort device metadata for the current install, keyed by snake_case
 * column names matching `devices`. Sent to `POST /identity/refresh`, which merges
 * the record into the server row without field-name remapping.
 */
export function collectDeviceSnapshot(): Record<string, string> {
  const attrs: Record<string, string> = {};
  put(attrs, 'platform', Platform.OS);
  put(attrs, 'os_name', normString(Device.osName));
  put(attrs, 'os_version', normString(Device.osVersion));
  put(attrs, 'device_model_name', normString(Device.modelName));
  put(attrs, 'device_brand', normString(Device.brand));
  put(attrs, 'device_name', normString(Constants.deviceName));
  put(attrs, 'app_version', normString(Constants.expoConfig?.version));
  put(attrs, 'app_build_number', resolveAppBuildNumber());
  put(attrs, 'user_agent', readWebUserAgent());
  return attrs;
}
