import { claimUsernameMutation } from '@libs/profile-shared-ts/claim-username-mutation';
import type { ProfileRow } from '@libs/profile-shared-ts/profile-row-sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { Accessor, JSX } from 'solid-js';
import { createEffect, createSignal } from 'solid-js';
import { useMyProfileId } from './claim-username-use-my-profile-id';
import { useProfileRow } from './claim-username-use-profile-row';
import { ProfileHandleScreenView } from './profile-handle-screen-view';
import { useStandInName } from './use-stand-in-name';
import { useUsernameChange } from './use-username-change';

function useSyncedUsername(row: Accessor<ProfileRow | null>) {
  const [value, setValue] = createSignal('');
  const lastPersistedRef = { current: null as string | null };

  createEffect(() => {
    const current = row();
    if (current === null) return;
    const persisted =
      typeof current.username === 'string' ? current.username : '';
    const prev = lastPersistedRef.current;
    if (prev === null) {
      setValue((draft) => (draft === '' ? persisted : draft));
      lastPersistedRef.current = persisted;
      return;
    }
    if (persisted !== prev) {
      setValue((draft) => (draft === prev ? persisted : draft));
      lastPersistedRef.current = persisted;
    }
  });

  return [value, setValue] as const;
}

/** `/profile/handle`: wires `ProfileHandleScreenView` to the claim-username mutation. */
export function ProfileHandleScreen(): JSX.Element {
  const router = useRouter();
  const profileId = useMyProfileId();
  const { row } = useProfileRow(profileId);
  const [value, setValue] = useSyncedUsername(row);
  const standInName = useStandInName(row);
  const usernameChange = useUsernameChange();
  const mutationClient = useMutationClient();
  const [lastError, setLastError] = createSignal<{
    readonly code: string;
  } | null>(null);

  const save = async () => {
    const id = profileId();
    if (id === null) return;
    setLastError(null);
    const result = await mutationClient.mutate(claimUsernameMutation, {
      username: value(),
    });
    if (!result.ok) {
      const failure = result.failures[0];
      if (failure !== undefined) {
        setLastError(failure);
        throw new Error(failure.message);
      }
      throw new Error("Couldn't save");
    }
  };

  return (
    <ProfileHandleScreenView
      value={value()}
      standInName={standInName()}
      saveError={lastError()}
      canSave={profileId() !== null}
      usernameChange={usernameChange()}
      onValueChange={setValue}
      onSave={save}
      onCancel={() => router.back()}
    />
  );
}
