import { SESSION_EXTERNAL_USER_ID_KEY } from '@libs/auth/public/auth-storage-keys';
import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useMyId } from '@libs/auth/public/use-current-user';
import { createSecureStorageItemOptional } from '@pkgs/secure-storage/solid';
import type { JSX, ParentProps } from 'solid-js';
import { createEffect } from 'solid-js';

import { ProfileEnsurer } from '../../use-cases/ensure-profile/client/ensure-profile';

/**
 * Profile bootstrap: ensures a local profile row (with auto username) for the
 * current `users.id`. Upload via `/api/mutations` assigns uniqueness on
 * Postgres.
 */
function ProfileEntityBootstrap(): JSX.Element {
  const myId = useMyId();
  const externalUserItem = createSecureStorageItemOptional(
    SESSION_EXTERNAL_USER_ID_KEY
  );
  const mutationClient = useMutationClient();

  createEffect(() => {
    const id = myId();
    if (id.length === 0) return;
    // React to the IdP session too: sign-in upgrades the anonymous user in
    // place (same `users.id`), so `myId` alone never flips post-sign-in and
    // the signup-username handoff would only ever be consumed by luck.
    // Hosts without secure storage (sims) skip this reactivity and still
    // work because the mutation itself handles both paths.
    externalUserItem.value();
    void new ProfileEnsurer(mutationClient).ensure().catch(() => {
      // Best-effort: re-asserted on the next identity change.
    });
  });

  return null;
}

/**
 * Mounts {@link ProfileEntityBootstrap}. Responds to identity changes via
 * {@link useMyId}.
 */
export function ProfileProvider(props: ParentProps): JSX.Element {
  return (
    <>
      <ProfileEntityBootstrap />
      {props.children}
    </>
  );
}
