import {
  getCachedSecureStorageValue,
  useSecureStorageItem,
} from '@gamezilla/lib/secure-storage/use-secure-storage-item';

import { SESSION_TOKEN_KEY } from './auth-storage-keys';

/**
 * Reactive accessor for the bearer JWT issued by Better Auth. `null` when
 * signed out or before hydration completes.
 */
export function useSessionToken(): string | null {
  const { value } = useSecureStorageItem(SESSION_TOKEN_KEY);
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

/** Synchronous variant for the patch-db transport's `getAuthToken` callback. */
export function getCachedSessionToken(): string | null {
  const raw = getCachedSecureStorageValue(SESSION_TOKEN_KEY);
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}
