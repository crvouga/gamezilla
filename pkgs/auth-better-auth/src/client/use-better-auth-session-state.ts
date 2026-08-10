import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import type { VerifiedSession } from '@pkgs/auth/shared/verified-session';
import { useEffect, useState } from 'react';

import {
  clearStoredBearerToken,
  peekBearerToken,
  readStoredBearerToken,
} from './bearer-token-store';
import { getOrCreateBetterAuthReactClient } from './create-auth-client';
import { readAuthBaseURL } from './read-auth-base-url';

function mapSession(data: {
  user: { id: string; email: string };
  session: { expiresAt: Date | string };
}): VerifiedSession {
  return {
    externalUserId: data.user.id,
    accountId: null,
    email: data.user.email ?? null,
    expiresAt:
      data.session.expiresAt instanceof Date
        ? data.session.expiresAt
        : new Date(data.session.expiresAt),
  };
}

/**
 * Reactive session snapshot. Requires {@link createBetterAuthClientAdapter}
 * to have been constructed with a baseURL (client singleton).
 *
 * When a bearer token is present (e.g. E2E injection / reload) but the React
 * session cache is empty, we resolve once via `getSession` with Bearer.
 */
export function useBetterAuthSessionState(): AuthSessionState {
  const client = getOrCreateBetterAuthReactClient({
    baseURL: readAuthBaseURL(),
  });
  const { data, isPending, error } = client.useSession();
  const [bearerSession, setBearerSession] = useState<VerifiedSession | null>(
    null
  );
  const [bearerHydrated, setBearerHydrated] = useState(false);
  // After the first settle, keep hydrated even if useSession flaps isPending
  // during refetch storms — otherwise resumePending SignInModal hangs forever.
  const [hasSettledOnce, setHasSettledOnce] = useState(false);

  useEffect(() => {
    if (!isPending) setHasSettledOnce(true);
  }, [isPending]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await readStoredBearerToken();
      const token = peekBearerToken();
      if (token === null) {
        if (!cancelled) {
          setBearerSession(null);
          setBearerHydrated(true);
        }
        return;
      }
      const result = await client.getSession({
        fetchOptions: {
          headers: { Authorization: `Bearer ${token}` },
        },
      });
      if (cancelled) return;
      if (result.data !== null && result.data !== undefined) {
        setBearerSession(mapSession(result.data));
      } else {
        // Dead bearer overrides the OAuth cookie on the next request — drop it.
        await clearStoredBearerToken();
        setBearerSession(null);
      }
      setBearerHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, data]);

  if (data !== null && data !== undefined) {
    return {
      session: mapSession(data),
      isHydrated: true,
      error: null,
    };
  }

  // Initial cookie fetch only — do not unhydrate on later refetch storms.
  if (!hasSettledOnce && isPending && bearerSession === null) {
    return { session: null, isHydrated: false, error: null };
  }

  if (!bearerHydrated && bearerSession === null && !hasSettledOnce) {
    return { session: null, isHydrated: false, error: null };
  }

  // Signed out: no cookie session and no bearer — drop stale bearerSession.
  if (peekBearerToken() === null) {
    return { session: null, isHydrated: true, error: null };
  }

  if (error !== null && error !== undefined) {
    return {
      session: bearerSession,
      isHydrated: true,
      error:
        bearerSession === null
          ? new Error(error.message ?? 'Better Auth session error')
          : null,
    };
  }

  return {
    session: bearerSession,
    isHydrated: true,
    error: null,
  };
}
