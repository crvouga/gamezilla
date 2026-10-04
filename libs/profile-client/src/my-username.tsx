import { Handles } from '@libs/test-ids-shared/handles';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useMyProfileId } from './public-use-my-profile-id';
import { UserUsername } from './user-username';
import type { UserUsernameProps } from './user-username';

export type MyUsernameProps = Omit<UserUsernameProps, 'profileId' | 'dataSet'>;

/**
 * Sugar: `<UserUsername profileId={useMyProfileId()} … />` (SQLite only).
 * Returns null while the sync engine paint gate is closed so sticky
 * prior-identity rows do not flash the wrong handle.
 */
export function MyUsername(props: MyUsernameProps): JSX.Element {
  const { paintReady } = useSyncEngine();
  const profileId = useMyProfileId();
  return (
    <Show when={paintReady()}>
      <Show when={profileId()} keyed>
        {(id) => (
          <UserUsername
            profileId={id}
            variant={props.variant}
            class={props.class}
            numberOfLines={props.numberOfLines}
            withAt={props.withAt}
            dataSet={{ testid: Handles.profileDisplayUsername }}
          />
        )}
      </Show>
    </Show>
  );
}
