import { usePatchesDb } from '@gamezilla/patch-db/react';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { Box, ScreenBase, TextInput } from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useProfile } from '@gamezilla/client/features/profile/use-profile';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';

export default function ProfileUsernameScreen() {
  const router = useRouter();
  const db = usePatchesDb();
  const { principalId, entity } = useProfile();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const nav = useBreadcrumbNav();

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

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await db.write([
        {
          entityId: principalId,
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
  }, [db, principalId, router, value]);

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
          disabled: saving,
        },
      ]}
      keyboardAvoiding
      content={({ sx }) => (
        <Box style={sx}>
          <TextInput
            label="Display name"
            value={value}
            onChangeText={setValue}
            placeholder="Your name"
            autoCapitalize="words"
            autoCorrect
          />
        </Box>
      )}
    />
  );
}
