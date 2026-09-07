import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { useMyId } from '@libs/auth/public/use-current-user';
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
  const mutationClient = useMutationClient();

  createEffect(() => {
    const id = myId();
    if (id.length === 0) return;
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
