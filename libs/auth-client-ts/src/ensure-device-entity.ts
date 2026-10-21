import { ensureDeviceMutation } from '@libs/auth-shared-ts/ensure-device-mutation';
import type { MutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';

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

function readWebUserAgent(): string | null {
  if (typeof globalThis === 'undefined') return null;
  if (!('navigator' in globalThis) || globalThis.navigator === undefined) {
    return null;
  }
  if (typeof globalThis.navigator.userAgent !== 'string') return null;
  return normString(globalThis.navigator.userAgent);
}

/** Collects web device metadata; stays CLIENT-only. */
export function collectDeviceSnapshot(): DeviceSnapshot {
  return {
    platform: 'web',
    os_name: null,
    os_version: null,
    device_model_name: null,
    device_brand: null,
    device_name: null,
    app_version: null,
    app_build_number: null,
    user_agent: readWebUserAgent(),
  };
}

/**
 * Ensures a `devices` row exists locally with id + created_at (first launch),
 * then on every launch refreshes `last_seen_at` and any changed device metadata.
 */
export class EnsureDeviceEntity {
  constructor(private readonly mutationClient: MutationClient) {}

  async run(): Promise<void> {
    const snapshot = collectDeviceSnapshot();
    const result = await this.mutationClient.mutate(
      ensureDeviceMutation,
      snapshot
    );
    if (!result.ok) throw new Error(result.failures[0]?.message);
  }
}
