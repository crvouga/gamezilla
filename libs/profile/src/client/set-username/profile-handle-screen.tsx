import { useMutationClient } from '@libs/auth/client/mutation-client-provider';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  type BodyContentProps,
  Box,
  FormActionsFooter,
  ScreenBase,
  TextInput,
} from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { useRouter } from 'expo-router';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { claimUsernameMutation } from '../../shared/mutations/profile-mutations';
import { useMyProfileId } from '../use-my-profile-id';
import { type ProfileRow, useProfileRow } from '../use-profile-row';

function useSyncedUsername(row: ProfileRow | null) {
  const [value, setValue] = useState('');
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    if (row === null) return;
    const persisted = typeof row.username === 'string' ? row.username : '';
    const prev = lastPersistedRef.current;
    if (prev === null) {
      setValue((current) => (current === '' ? persisted : current));
      lastPersistedRef.current = persisted;
      return;
    }
    if (persisted !== prev) {
      setValue((current) => (current === prev ? persisted : current));
      lastPersistedRef.current = persisted;
    }
  }, [row]);

  return [value, setValue] as const;
}

function ProfileHandleScreenBody({
  sx,
  value,
  setValue,
}: {
  sx: BodyContentProps['sx'];
  value: string;
  setValue: (v: string) => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <Box sx={sx}>
      <TextInput
        label={<Trans>Username</Trans>}
        value={value}
        onChangeText={setValue}
        placeholder={t`your_handle`}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </Box>
  );
}

function usernameErrorLabel(
  error: { readonly code: string } | null
): ReactNode {
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

export function ProfileHandleScreen() {
  const router = useRouter();
  const profileId = useMyProfileId();
  const { row } = useProfileRow(profileId);
  const [value, setValue] = useSyncedUsername(row);
  const nav = useBreadcrumbNav();
  const mutationClient = useMutationClient();
  const [lastError, setLastError] = useState<{ readonly code: string } | null>(
    null
  );

  const save = useCallback(async () => {
    if (profileId === null) return;
    setLastError(null);
    const result = await mutationClient.mutate(claimUsernameMutation, {
      username: value,
    });
    if (!result.ok) {
      const failure = result.failures[0];
      if (failure !== undefined) {
        setLastError(failure);
        throw new Error(failure.message);
      }
      throw new Error("Couldn't save");
    }
  }, [mutationClient, profileId, value]);

  return (
    <ScreenBase
      screenId="profile-handle"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: <Trans>Edit profile</Trans>, onPress: nav('/profile/edit') },
        { name: <Trans>Username</Trans> },
      ]}
      keyboardAvoiding
      footer={
        <FormActionsFooter
          cancel={{
            label: <Trans>Cancel</Trans>,
            onPress: () => router.back(),
          }}
          submit={{
            label: <Trans>Save</Trans>,
            loadingLabel: <Trans>Saving…</Trans>,
            successLabel: <Trans>Saved</Trans>,
            errorLabel: usernameErrorLabel(lastError),
            operation: save,
            disabled: profileId === null,
          }}
        />
      }
      content={({ sx }) => (
        <ProfileHandleScreenBody sx={sx} value={value} setValue={setValue} />
      )}
    />
  );
}
