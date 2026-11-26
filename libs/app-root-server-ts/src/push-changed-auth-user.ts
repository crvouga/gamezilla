import { requireRequestStore } from '@libs/app-root-shared-ts/request-scope';
import { ChangedAuthUserResync } from '@libs/auth-server-ts/changed-auth-user-resync';
import type { AuthProvider } from '@pkgs/auth-root-shared-ts/auth-provider-module';
import { notifyUserChannels } from './notify-user-channels';

/**
 * The auth service changed a user's sign-in methods without the product
 * asking: mirror them again and push them to the user's devices now, rather
 * than when a device next signs in.
 */
export async function pushChangedAuthUser(
  auth: AuthProvider,
  externalUserId: string
): Promise<void> {
  const store = requireRequestStore();
  const accountId = await new ChangedAuthUserResync(
    store.sqlClient,
    auth.server,
    { now: () => store.clock.now(), createId: store.createId }
  ).resync(externalUserId);
  if (accountId === null) return;
  await notifyUserChannels([accountId], 'auth-user-changed');
}
