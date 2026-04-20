import { usePatchesDb } from '@gamezilla/patch-db/react';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/shared/profile/profile-entities';
import {
  Box,
  Button,
  KeyboardAvoidingView,
  TextInput,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useProfile } from '@/features/profile/use-profile';
import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileUsernameScreen() {
  const router = useRouter();
  const db = usePatchesDb();
  const { principalId, entity } = useProfile();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = entity?.attributes[ProfileAttr.displayName];
    setValue(typeof raw === 'string' ? raw : '');
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
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Username" fallbackHref="/profile/edit" />
      <KeyboardAvoidingView sx={{ flex: 1 }}>
        <ConstrainedContent>
          <Box sx={{ flex: 1, px: 4, pt: 4, gap: 4 }}>
            <TextInput
              label="Display name"
              value={value}
              onChangeText={setValue}
              placeholder="Your name"
              autoCapitalize="words"
              autoCorrect
            />
            <Button
              title="Save"
              onPressIn={() => void save()}
              loading={saving}
              disabled={saving}
            />
          </Box>
        </ConstrainedContent>
      </KeyboardAvoidingView>
    </Box>
  );
}
