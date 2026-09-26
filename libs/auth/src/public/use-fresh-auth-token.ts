import type { GetFreshTokenOptions } from '@pkgs/auth/client';
import { createSecureStorageItem } from '@pkgs/secure-storage/solid';
import type { Accessor } from 'solid-js';
import { useAuthClientPort } from './auth-client-provider';
import { SESSION_TOKEN_KEY } from './auth-storage-keys';

/**
 * Reactive bearer token for the current session. Reads secure storage populated
 * by {@link AuthBridge} from ceremony mint / refresh. Local-first: does not wait
 * on IdP `useSession`. Suspends until `sessionToken` has been read.
 */
export function useFreshAuthToken(): Accessor<string | null> {
  const item = createSecureStorageItem(SESSION_TOKEN_KEY);
  return () => item.value() || null;
}

export type GetFreshAuthTokenFn = (
  options?: GetFreshTokenOptions
) => Promise<string | null>;

/** Returns the port's async token fetcher for one-off authenticated requests. */
export function useGetFreshAuthToken(): GetFreshAuthTokenFn {
  const port = useAuthClientPort();
  return (options) => port.getFreshToken(options);
}
