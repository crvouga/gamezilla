import type { GetFreshTokenOptions } from '@pkgs/auth/client/auth-client-port';
import { useHydratedSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';
import { useAuthClientPort } from './auth-client-provider';
import { SESSION_TOKEN_KEY } from './auth-storage-keys';

/**
 * Reactive bearer token for the current session. Reads secure storage populated
 * by {@link AuthBridge} from {@link AuthClientPort.getFreshToken}; `null` when
 * signed out. Suspends until the product `sessionToken` key has been read so
 * chrome cannot flash "Sign in" while a persisted token is still loading.
 */
export function useFreshAuthToken(): string | null {
  const port = useAuthClientPort();
  const { session, isHydrated } = port.useAuthSession();
  const { value } = useHydratedSecureStorageItem(SESSION_TOKEN_KEY);
  if (!isHydrated || session === null) return null;
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
