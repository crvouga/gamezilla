import { useAuthClientPort } from '@libs/auth-client/auth-client-provider';
import { SESSION_EXTERNAL_USER_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { useMyId } from '@libs/auth-client/use-current-user';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { createSecureStorageItemOptional } from '@pkgs/secure-storage-client/solid';
import type { JSX, ParentProps } from 'solid-js';
import { createEffect } from 'solid-js';

import { ProfileEnsurer } from './ensure-profile';

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
  const authClient = useAuthClientPort();

  createEffect(() => {
    const id = myId();
    if (id.length === 0) return;
    // The bridge writes the provider identity only after the account is ready.
    // An earlier anonymous bootstrap must leave the signup handoff pending.
    const externalId = externalUserItem.value();
    void new ProfileEnsurer(mutationClient, authClient)
      .ensure(typeof externalId === 'string' ? externalId : null)
      .catch(() => {
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
