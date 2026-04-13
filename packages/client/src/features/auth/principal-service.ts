import { assertPrincipalId } from '@gamezilla/shared/auth';
import { assert } from '@gamezilla/shared/assert';
import type { InjectionToken } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import type { SecureStorage } from '@gamezilla/shared/secure-storage/interface';

import { migratePrincipalStorageWebLegacy } from './migrate-principal-storage-web-legacy';

/** Must match expo-secure-store key rules (`[\w.-]+`); was `gamezilla:principalId` before (invalid on native). */
export const PRINCIPAL_STORAGE_KEY = 'gamezilla.principalId';

export interface PrincipalService {
  /** Stable device principal UUID; never null. Crashes if invariant violated. */
  getPrincipalId(): string;
}

export const PrincipalServiceToken: InjectionToken<PrincipalService> =
  Symbol('PrincipalService');

/**
 * Loads or creates principalId in secure storage. If stored value is corrupt, crashes
 * (does not silently regenerate — that would orphan patches).
 */
export async function createPrincipalService(
  storage: SecureStorage
): Promise<PrincipalService> {
  await migratePrincipalStorageWebLegacy(storage, PRINCIPAL_STORAGE_KEY);

  let raw: string | null = null;
  try {
    raw = await storage.getItem(PRINCIPAL_STORAGE_KEY);
  } catch (err) {
    assert.fail(
      'Failed to read principalId from secure storage — refusing to generate a new id',
      { error: err instanceof Error ? err.message : String(err) }
    );
  }

  if (raw === null) {
    const id = globalThis.crypto.randomUUID();
    try {
      await storage.setItem(PRINCIPAL_STORAGE_KEY, id);
    } catch (err) {
      assert.fail('Failed to persist new principalId to secure storage', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    raw = id;
  }

  assertPrincipalId(raw);

  const principalId: string = raw;

  return {
    getPrincipalId(): string {
      assertPrincipalId(principalId);
      return principalId;
    },
  };
}
