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
import { useCallback, useEffect, useRef, useState } from 'react';

import { useProfile } from '@/features/profile/use-profile';
import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileUsernameScreen() {
  const router = useRouter();
  const db = usePatchesDb();
  const { principalId, entity } = useProfile();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Track last-seen persisted name so we can distinguish "entity reference
  // changed because PatchDB polled" from "persisted value actually changed".
  // Without this, every poll reassigns `value` and wipes the user's edits.
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
      // Persisted value changed (e.g. another device). Only overwrite the
      // in-progress draft if the user hasn't edited it yet.
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
              onPress={() => void save()}
              loading={saving}
              disabled={saving}
            />
          </Box>
        </ConstrainedContent>
      </KeyboardAvoidingView>
    </Box>
  );
}
