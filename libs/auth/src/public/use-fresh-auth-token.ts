import type { GetFreshTokenOptions } from '@pkgs/auth/client/auth-client-port';
import { useHydratedSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';
import { useAuthClientPort } from './auth-client-provider';
import { SESSION_TOKEN_KEY } from './auth-storage-keys';

/**
 * Reactive bearer token for the current session. Reads secure storage populated
 * by {@link AuthBridge} from ceremony mint / refresh. Local-first: does not wait
 * on Better Auth `useSession`. Suspends until `sessionToken` has been read.
 */
export function useFreshAuthToken(): string | null {
  const { value } = useHydratedSecureStorageItem(SESSION_TOKEN_KEY);
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

export type GetFreshAuthTokenFn = (
  options?: GetFreshTokenOptions
) => Promise<string | null>;

/** Returns the port's async token fetcher for one-off authenticated requests. */
export function useGetFreshAuthToken(): GetFreshAuthTokenFn {
  const port = useAuthClientPort();
  return useCallback(
    (options?: GetFreshTokenOptions) => port.getFreshToken(options),
    [port]
  );
}
