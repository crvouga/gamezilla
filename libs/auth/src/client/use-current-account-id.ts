import {
  getCachedSecureStorageValue,
  useHydratedSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';

import { isUuid } from '../shared/device-id';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from './auth-storage-keys';

/**
 * Internal `accountId` of the locally signed-in user, or `null` when signed
 * out. Sourced from secure storage so cold-starts resolve before any HTTP
 * round-trip. Suspends until the key has been read (same as {@link useDeviceId}).
 */
export function useCurrentAccountId(): string | null {
  const { value } = useHydratedSecureStorageItem(LAST_LOCAL_ACCOUNT_ID_KEY);
  if (typeof value === 'string' && isUuid(value)) return value;
  return null;
}

/** Synchronous variant for non-React code (`myId` resolution). */
export function getCachedCurrentAccountId(): string | null {
  const raw = getCachedSecureStorageValue(LAST_LOCAL_ACCOUNT_ID_KEY);
  if (typeof raw === 'string' && isUuid(raw)) return raw;
  return null;
}
