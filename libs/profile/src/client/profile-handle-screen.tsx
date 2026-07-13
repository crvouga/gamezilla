import { useMyProfileId } from './use-my-profile-id';
import { useProfileRow, type ProfileRow } from './use-profile-row';
import { ProfileError, isProfileError } from '../shared/profile-errors';
import { setUsernameOnline } from './profile-online-actions';
import { useProfileClientDeps } from './use-profile-client-deps';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import {
  Box,
  FormActionsFooter,
  ScreenBase,
  TextInput,
  type BodyContentProps,
} from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
    <Box style={sx}>
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

function usernameErrorLabel(error: unknown): ReactNode {
  if (!isProfileError(error)) {
    return <Trans>Couldn't save</Trans>;
  }
  switch (error.code) {
    case 'PROFILE_USERNAME_TAKEN':
      return <Trans>Username is taken</Trans>;
    case 'PROFILE_USERNAME_COOLDOWN':
      return <Trans>Username was changed recently</Trans>;
    case 'PROFILE_USERNAME_TOO_SHORT':
      return <Trans>Username is too short</Trans>;
    case 'PROFILE_USERNAME_TOO_LONG':
      return <Trans>Username is too long</Trans>;
    case 'PROFILE_USERNAME_INVALID_FORMAT':
      return <Trans>Username can only use letters, numbers, and _</Trans>;
    case 'PROFILE_USERNAME_EMPTY':
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
  const deps = useProfileClientDeps();
  const [lastError, setLastError] = useState<unknown>(null);

  const save = useCallback(async () => {
    if (profileId === null) return;
    setLastError(null);
    try {
      await setUsernameOnline(deps, value.trim());
    } catch (error) {
      setLastError(error);
      throw error instanceof ProfileError ? error : new Error("Couldn't save");
    }
  }, [deps, profileId, value]);

  return (
    <ScreenBase
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
