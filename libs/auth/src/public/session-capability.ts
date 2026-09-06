/**
 * Install-local session capability in secure storage: bearer + expiry +
 * external user id. Steady-state chrome reads these; IdP only mints.
 */

import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';

import {
  SESSION_EXPIRES_AT_KEY,
  SESSION_EXTERNAL_USER_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';

export type SessionCapability = {
  readonly token: string;
  readonly expiresAt: string | null;
  readonly externalUserId: string | null;
};

function readNonEmpty(store: SecureStorageStore, key: string): string | null {
  const raw = store.getValue(key);
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

export class SessionCapabilityStore {
  constructor(private readonly store: SecureStorageStore) {}

  /** Snapshot of the install session capability from secure storage. */
  read(): SessionCapability | null {
    const token = readNonEmpty(this.store, SESSION_TOKEN_KEY);
    if (token === null) return null;
    return {
      token,
      expiresAt: readNonEmpty(this.store, SESSION_EXPIRES_AT_KEY),
      externalUserId: readNonEmpty(this.store, SESSION_EXTERNAL_USER_ID_KEY),
    };
  }

  readToken(): string | null {
    return readNonEmpty(this.store, SESSION_TOKEN_KEY);
  }

  readExpiresAt(): string | null {
    return readNonEmpty(this.store, SESSION_EXPIRES_AT_KEY);
  }

  readExternalUserId(): string | null {
    return readNonEmpty(this.store, SESSION_EXTERNAL_USER_ID_KEY);
  }

  /** Persist bearer + optional session meta after mint / refresh. */
  async write(capability: SessionCapability): Promise<void> {
    await this.store.write(SESSION_TOKEN_KEY, capability.token);
    await this.store.write(SESSION_EXPIRES_AT_KEY, capability.expiresAt);
    await this.store.write(
      SESSION_EXTERNAL_USER_ID_KEY,
      capability.externalUserId
    );
  }

  /** Clear bearer and session meta (sign-out / wipe / anon ensure). */
  async clear(): Promise<void> {
    await this.store.write(SESSION_TOKEN_KEY, null);
    await this.store.write(SESSION_EXPIRES_AT_KEY, null);
    await this.store.write(SESSION_EXTERNAL_USER_ID_KEY, null);
  }
}

/**
 * Local-first “has provider session”: hydrated storage + non-empty bearer.
 * Missing `auth_users` row must not flash guest while sync catches up.
 */
export function resolveHasAuthSession(args: {
  readonly storageHydrated: boolean;
  readonly sessionToken: string | null;
}): boolean {
  if (!args.storageHydrated) return false;
  return args.sessionToken !== null && args.sessionToken.length > 0;
}
