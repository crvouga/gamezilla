import { SESSION_TOKEN_KEY } from '@libs/auth-shared/auth-storage-keys';
import {
  resolveIsSignedIn,
  resolveMyId,
} from '@libs/auth-shared/resolve-client-identity';
import { resolveHasAuthSession } from '@libs/auth-shared/session-capability';
import { createSecureStorageItem } from '@pkgs/secure-storage-client/solid';
import sql from '@pkgs/sql-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useCurrentAccountId } from './use-current-account-id';
import { useFreshAuthToken } from './use-fresh-auth-token';

/**
 * Sign-in state, as access input. Only `@libs/permissions` imports this
 * module (the `import-access-facts` lint rule): everything else asks the
 * permission system what the caller may do and never learns whether they are
 * signed in.
 */

function readIsAnonFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't';
}

/**
 * `true` when bound to a non-anon user with a session token.
 */
export function useIsSignedIn(): Accessor<boolean> {
  const accountId = useCurrentAccountId();
  const token = useFreshAuthToken();
  const isAnon = useIsAnon();
  return createMemo(() => resolveIsSignedIn(accountId(), token(), isAnon()));
}

/**
 * Local-first provider session: hydrated secure storage has a bearer.
 * Does not wait on IdP `useSession`.
 */
export function useHasAuthSession(): Accessor<boolean> {
  const item = createSecureStorageItem(SESSION_TOKEN_KEY);
  return createMemo(() => {
    const value = item.value();
    const token = typeof value === 'string' && value.length > 0 ? value : null;
    return resolveHasAuthSession({
      storageHydrated: item.isHydrated(),
      sessionToken: token,
    });
  });
}

/**
 * `true` when the active `users` row is anon (no provider session / link).
 */
export function useIsAnon(): Accessor<boolean> {
  const hasSession = useHasAuthSession();
  const accountId = useCurrentAccountId();
  const myId = createMemo(() => resolveMyId(accountId()));
  const watchId = createMemo(() => {
    const id = myId();
    return id.length > 0 ? id : '';
  });
  const rows = createQuery(
    () => sql<{ is_anon: number | boolean | null }>`
    SELECT is_anon
    FROM auth_users
    WHERE id = ${watchId()}
  `
  );
  const row = createMemo(() => rows.rows()[0] ?? null);
  return createMemo(() => {
    if (hasSession()) return false;
    const id = myId();
    if (id.length === 0) return true;
    const current = row();
    if (current === null) return true;
    return readIsAnonFlag(current.is_anon);
  });
}
