import { PrincipalAvatar } from '@gamezilla/client/profile/principal-avatar';
import {
  Box,
  GradientBox,
  Pressable,
  StatusDot,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';

import type { SpaceView } from './types';

function HostHeader({ space }: { space: SpaceView }) {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}>
      <PrincipalAvatar
        avatarConfig={space.hostAvatarConfig}
        principalId={space.hostId}
        size={44}
        vividBackdrop
      />
      <Box sx={{ flex: 1, gap: 0.5 }}>
        <Text
          variant="bodyBold"
          sx={{ color: '#FFFFFF' }}
          numberOfLines={1}
          label={space.title}
        />
        <Text
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.85)' }}
          label={space.hostDisplayName}
        />
      </Box>
    </Box>
  );
}

function StatusBadge({ live }: { live: boolean }) {
  if (live) {
    return (
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          backgroundColor: 'rgba(255,255,255,0.22)',
          borderRadius: 999,
          px: 2,
          py: 1,
          alignSelf: 'flex-start',
        }}
      >
        <StatusDot status="online" size={8} />
        <Text variant="caption" sx={{ color: '#FFFFFF' }} label="Live" />
      </Box>
    );
  }
  return (
    <Box
      sx={{
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(0,0,0,0.22)',
        borderRadius: 999,
        px: 2,
        py: 1,
      }}
    >
      <Text
        variant="caption"
        sx={{ color: 'rgba(255,255,255,0.9)' }}
        label="Ended"
      />
    </Box>
  );
}

export type SpaceCardProps = {
  space: SpaceView;
};

export function SpaceCard({ space }: SpaceCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const spaceCardGradientColors = [
    theme.colors.gradientPrimaryStart,
    theme.colors.gradientPrimaryEnd,
  ] as const;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/space/[id]', params: { id: space.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`Open space ${space.title}`}
    >
      <GradientBox
        colors={spaceCardGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        sx={{
          borderRadius: 16,
          p: 4,
          minHeight: 112,
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <HostHeader space={space} />
          <StatusBadge live={space.live} />
        </Box>
        <Box sx={{ mt: 3 }}>
          <Text
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.95)' }}
            label="Space"
          />
        </Box>
      </GradientBox>
    </Pressable>
  );
}
