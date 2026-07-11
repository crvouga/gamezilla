import { useWriteContext } from '@libs/auth/client/use-write-context';
import { useMyProfileId } from './use-my-profile-id';
import { useProfileRow, type ProfileRow } from './use-profile-row';
import { profilePatchWrite } from '../shared/writes/profile-patch-write';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import {
  Box,
  FormActionsFooter,
  ScreenBase,
  TextInput,
  type BodyContentProps,
} from '@pkgs/ui';
import { createSqlWriteStore } from '@pkgs/write/client/create-sql-write-store';
import { runClientWrite } from '@pkgs/write/client/run-client-write';
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

export function ProfileHandleScreen() {
  const router = useRouter();
  const engine = useSyncEngine();
  const profileId = useMyProfileId();
  const writeContext = useWriteContext();
  const { row } = useProfileRow(profileId);
  const [value, setValue] = useSyncedUsername(row);
  const nav = useBreadcrumbNav();

  const save = useCallback(async () => {
    if (profileId === null) return;
    const username = value.trim();
    const now = new Date().toISOString();
    await runClientWrite(
      profilePatchWrite,
      writeContext,
      {
        profileId,
        username,
        usernameChangedAt: now,
      },
      createSqlWriteStore(engine.db)
    );
  }, [engine, profileId, value, writeContext]);

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
        <ProfileHandleScreenBody sx={sx} value={value} setValue={setValue} />
      )}
    />
  );
}
