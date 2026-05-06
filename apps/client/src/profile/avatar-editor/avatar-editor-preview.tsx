import { ProfileDiceBearAvatar } from '@gamezilla/client/profile/profile-dicebear-avatar';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import { Box, Button, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';

export function AvatarPreview({
  previewConfig,
  seedFallback,
  initialized,
  shuffleSeed,
  copySeed,
}: {
  previewConfig: AvatarConfig;
  seedFallback: string;
  initialized: boolean;
  shuffleSeed: () => void;
  copySeed: () => Promise<void>;
}) {
  const { t } = useLingui();
  return (
    <Box sx={{ alignItems: 'center', gap: 2, minHeight: 260 }}>
      <ProfileDiceBearAvatar
        config={previewConfig}
        fallbackSeed={seedFallback}
        size={192}
      />
      <Box
        sx={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
        }}
      >
        <Button
          title={t`Shuffle seed`}
          variant="outlined"
          onPress={shuffleSeed}
          disabled={!initialized}
        />
        <Button
          title={t`Copy seed`}
          variant="outlined"
          onPress={() => void copySeed()}
          disabled={!initialized}
        />
      </Box>
      <Text
        variant="caption"
        sx={{ textAlign: 'center', opacity: 0.75 }}
        numberOfLines={1}
        label={
          <Trans>Preview updates as you edit. Save to keep changes.</Trans>
        }
      />
    </Box>
  );
}
