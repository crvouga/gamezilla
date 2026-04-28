import { useProfile } from '@gamezilla/client/profile/use-profile';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity } from '@gamezilla/patch-db/interface';
import { Box, ScreenBase, Text, TextInput } from '@gamezilla/lib/ui';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

function useSyncedDisplayName(entity: Entity | null | undefined) {
  const [value, setValue] = useState('');
  const lastPersistedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entity) return;
    const raw = entity.attributes[ProfileAttr.displayName];
    const persisted = typeof raw === 'string' ? raw : '';
    const prev = lastPersistedRef.current;
    if (prev === null) {
      setValue(persisted);
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

export function ProfileUsernameScreen() {
  const router = useRouter();
  const db = usePatchesDb();
  const { profileId, entity, loading } = useProfile();
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
        { name: 'Profile', onPress: nav('/profile') },
        { name: 'Edit profile', onPress: nav('/profile/edit') },
        { name: 'Username' },
      ]}
      actions={[
        {
          type: 'submit',
          label: 'Save',
          onPress: () => void save(),
          loading: saving,
          disabled: saving || loading || profileId === null,
        },
      ]}
      keyboardAvoiding
      content={({ sx }) => (
        <Box style={sx}>
          {!loading && profileId === null ? (
            <Box sx={{ gap: 2 }}>
              <Text
                variant="body"
                label="No active profile. Open Profiles and create or select one first."
              />
            </Box>
          ) : (
            <TextInput
              label="Display name"
              value={value}
              onChangeText={setValue}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect
            />
          )}
        </Box>
      )}
    />
  );
}
