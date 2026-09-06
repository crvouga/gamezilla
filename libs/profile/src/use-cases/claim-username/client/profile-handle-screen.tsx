import { useMutationClient } from '@libs/auth/public/mutation-client-provider';
import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  type BodyContentProps,
  Box,
  FormActionsFooter,
  ScreenBase,
  TextInput,
  useBreadcrumbNav,
  useRouter,
} from '@pkgs/ui';
import type { Accessor, JSX } from 'solid-js';
import { createEffect, createSignal } from 'solid-js';
import { claimUsernameMutation } from '../shared/claim-username-mutation';
import { useMyProfileId } from './use-my-profile-id';
import { type ProfileRow, useProfileRow } from './use-profile-row';

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

function ProfileHandleScreenBody(props: {
  sx: BodyContentProps['sx'];
  value: Accessor<string>;
  setValue: (v: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Box sx={props.sx}>
      <TextInput
        label={<Trans>Username</Trans>}
        aria-label={t`Username`}
        value={props.value()}
        onChangeText={props.setValue}
        placeholder={t`your_handle`}
        autocapitalize="none"
        autocorrect="off"
        dataSet={{ testid: Handles.profileUsernameInput }}
      />
    </Box>
  );
}

function usernameErrorLabel(
  error: { readonly code: string } | null
): JSX.Element {
  if (error === null) {
    return <Trans>Couldn't save</Trans>;
  }
  switch (error.code) {
    case 'USERNAME_TAKEN':
      return <Trans>Username is taken</Trans>;
    case 'USERNAME_COOLDOWN':
      return <Trans>Username was changed recently</Trans>;
    case 'USERNAME_TOO_SHORT':
      return <Trans>Username is too short</Trans>;
    case 'USERNAME_TOO_LONG':
      return <Trans>Username is too long</Trans>;
    case 'USERNAME_INVALID_FORMAT':
      return <Trans>Username can only use letters, numbers, and _</Trans>;
    case 'USERNAME_EMPTY':
      return <Trans>Username is required</Trans>;
    default:
      return <Trans>Couldn't save</Trans>;
  }
}

export function ProfileHandleScreen(): JSX.Element {
  const router = useRouter();
  const profileId = useMyProfileId();
  const { row } = useProfileRow(profileId);
  const [value, setValue] = useSyncedUsername(row);
  const nav = useBreadcrumbNav();
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
    <ScreenBase
      screenId="profile-handle"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
        { name: <Trans>Edit profile</Trans>, onClick: nav('/profile/edit') },
        { name: <Trans>Username</Trans> },
      ]}
      footer={
        <FormActionsFooter
          cancel={{
            label: <Trans>Cancel</Trans>,
            onClick: () => router.back(),
            dataSet: { testid: Handles.profileUsernameCancel },
          }}
          submit={{
            label: <Trans>Save</Trans>,
            loadingLabel: <Trans>Saving…</Trans>,
            successLabel: <Trans>Saved</Trans>,
            get errorLabel() {
              return usernameErrorLabel(lastError());
            },
            operation: save,
            get disabled() {
              return profileId() === null;
            },
            dataSet: { testid: Handles.profileUsernameSave },
          }}
        />
      }
      content={({ sx }) => (
        <ProfileHandleScreenBody sx={sx} value={value} setValue={setValue} />
      )}
    />
  );
}
