import type { MutationClient } from '@pkgs/sync-engine/client';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { ensureDeviceMutation } from '../shared/mutations/auth-mutations';

export type DeviceSnapshot = {
  readonly platform: string | null;
  readonly os_name: string | null;
  readonly os_version: string | null;
  readonly device_model_name: string | null;
  readonly device_brand: string | null;
  readonly device_name: string | null;
  readonly app_version: string | null;
  readonly app_build_number: string | null;
  readonly user_agent: string | null;
};

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
    platform: Platform.OS,
    os_name: normString(Device.osName),
    os_version: normString(Device.osVersion),
    device_model_name: normString(Device.modelName),
    device_brand: normString(Device.brand),
    device_name: normString(Constants.deviceName),
    app_version: normString(Constants.expoConfig?.version),
    app_build_number: resolveAppBuildNumber(),
    user_agent: readWebUserAgent(),
  };
}

/**
 * Ensures a `devices` row exists locally with id + created_at (first launch),
 * then on every launch refreshes `last_seen_at` and any changed device metadata.
 */
export async function ensureDeviceEntity(
  mutationClient: MutationClient
): Promise<void> {
  const snapshot = collectDeviceSnapshot();
  const result = await mutationClient.mutate(ensureDeviceMutation, snapshot);
  if (!result.ok) throw new Error(result.failures[0]?.message);
}
