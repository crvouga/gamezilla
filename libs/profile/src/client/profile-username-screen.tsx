import { useMyProfileId } from './use-my-profile-id';
import { useProfileRow, type ProfileRow } from './use-profile-row';
import { updateProfile } from './profile-actions';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import {
  Box,
  FormActionsFooter,
  ScreenBase,
  TextInput,
  type BodyContentProps,
} from '@pkgs/ui';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

function useSyncedDisplayName(row: ProfileRow | null) {
  const [value, setValue] = useState('');
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    if (row === null) return;
    const persisted =
      typeof row.display_name === 'string' ? row.display_name : '';
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

function ProfileUsernameScreenBody({
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
        label={<Trans>Display name</Trans>}
        value={value}
        onChangeText={setValue}
        placeholder={t`Your name`}
        autoCapitalize="words"
        autoCorrect
      />
    </Box>
  );
}

export function ProfileUsernameScreen() {
  const router = useRouter();
  const engine = useSyncEngine();
  const profileId = useMyProfileId();
  const row = useProfileRow(profileId);
  const [value, setValue] = useSyncedDisplayName(row);
  const nav = useBreadcrumbNav();

  const save = useCallback(async () => {
    if (profileId === null) return;
    await updateProfile(engine.db, profileId, { displayName: value.trim() });
  }, [engine, profileId, value]);

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
            errorLabel: <Trans>Couldn't save</Trans>,
            operation: save,
            disabled: profileId === null,
          }}
        />
      }
      content={({ sx }) => (
        <ProfileUsernameScreenBody sx={sx} value={value} setValue={setValue} />
      )}
    />
  );
}
