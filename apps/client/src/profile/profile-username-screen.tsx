import { useMyProfileId } from '@gamezilla/client/profile/use-my-profile-id';
import { useProfileEntityById } from '@gamezilla/client/profile/use-profile-entity-by-id';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import {
  Box,
  ScreenBase,
  TextInput,
  type BodyContentProps,
} from '@gamezilla/lib/ui';
import type { Entity } from '@gamezilla/patch-db/interface';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

function useSyncedDisplayName(entity: Entity | null) {
  const [value, setValue] = useState('');
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entity) return;
    const raw = entity.attributes[ProfileAttr.displayName];
    const persisted = typeof raw === 'string' ? raw : '';
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
  }, [entity]);

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
  const db = usePatchDb();
  const profileId = useMyProfileId();
  const entity = useProfileEntityById(profileId);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useSyncedDisplayName(entity);
  const nav = useBreadcrumbNav();

  const save = useCallback(async () => {
    if (profileId === null) return;
    setSaving(true);
    try {
      await db.write([
        {
          entityId: profileId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.displayName]: value.trim(),
          },
        },
      ]);
      router.back();
    } finally {
      setSaving(false);
    }
  }, [db, profileId, router, value]);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onPress: nav('/profile') },
        { name: <Trans>Edit profile</Trans>, onPress: nav('/profile/edit') },
        { name: <Trans>Username</Trans> },
      ]}
      actions={[
        {
          type: 'submit',
          label: <Trans>Save</Trans>,
          onPress: () => void save(),
          loading: saving,
          disabled: saving,
        },
      ]}
      keyboardAvoiding
      content={({ sx }) => (
        <ProfileUsernameScreenBody sx={sx} value={value} setValue={setValue} />
      )}
    />
  );
}
