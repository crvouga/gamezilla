import { usePatchesDb } from '@gamezilla/patch-db/react';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/shared/profile/profile-entities';
import { Box, Button, Text } from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ProfileDiceBearAvatar } from '@/features/profile/profile-dicebear-avatar';
import { useProfile } from '@/features/profile/use-profile';
import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileAvatarScreen() {
  const router = useRouter();
  const db = usePatchesDb();
  const { principalId, entity } = useProfile();
  const [draftSeed, setDraftSeed] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = entity?.attributes[ProfileAttr.avatarSeed];
    setDraftSeed(typeof raw === 'string' ? raw : '');
  }, [entity]);

  const previewSeed = useMemo(() => {
    const t = draftSeed.trim();
    return t.length > 0 ? t : principalId;
  }, [draftSeed, principalId]);

  const shuffle = useCallback(() => {
    setDraftSeed(globalThis.crypto.randomUUID());
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await db.write([
        {
          entityId: principalId,
          entityType: PROFILE_ENTITY_TYPE,
          attributes: {
            [ProfileAttr.avatarSeed]: draftSeed.trim(),
          },
        },
      ]);
      router.back();
    } finally {
      setSaving(false);
    }
  }, [db, draftSeed, principalId, router]);

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Avatar" fallbackHref="/profile/edit" />
      <ConstrainedContent>
        <Box
          sx={{
            flex: 1,
            px: 4,
            pt: 4,
            gap: 4,
            alignItems: 'center',
          }}
        >
          <ProfileDiceBearAvatar seed={previewSeed} size={160} />
          <Text
            variant="caption"
            sx={{ textAlign: 'center', opacity: 0.8 }}
            label="Preview updates as you change the seed. Save to keep it."
          />
          <Box sx={{ alignSelf: 'stretch', gap: 3 }}>
            <Button title="Shuffle" variant="outlined" onPress={shuffle} />
            <Button
              title="Save"
              onPress={() => void save()}
              loading={saving}
              disabled={saving}
            />
          </Box>
        </Box>
      </ConstrainedContent>
    </Box>
  );
}
