import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import {
  AvatarGroup,
  Box,
  GradientBox,
  Pressable,
  StatusDot,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { SpaceView } from './types';
import { useSpaceMembers } from './use-spaces';

function HostHeader({ space }: { space: SpaceView }) {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}>
      <DeviceAvatar
        avatarConfig={space.hostAvatarConfig}
        seedFallback={space.hostId}
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

function LiveBadge() {
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
      <Text
        variant="caption"
        sx={{ color: '#FFFFFF' }}
        label={<Trans>Live</Trans>}
      />
    </Box>
  );
}

export type SpaceCardProps = {
  space: SpaceView;
};

const AVATAR_GROUP_RING = 'surface' as const;

function GuestSummary({ spaceId }: { spaceId: string }) {
  const { t } = useLingui();
  const { members } = useSpaceMembers(spaceId);
  const guests = useMemo(
    () => members.filter((m) => m.role === 'guest'),
    [members]
  );
  const guestCount = guests.length;
  const guestCountLabel =
    guestCount === 1 ? t`1 guest` : t`${guestCount} guests`;
  const guestNamesLabel = useMemo(() => {
    if (guests.length === 0) return t`No guests yet`;
    return guests
      .map((g) =>
        g.displayName.trim().length > 0 ? g.displayName : g.memberId
      )
      .join(', ');
  }, [guests, t]);

  return (
    <Box sx={{ mt: 3, gap: 1.5 }}>
      <Text
        variant="caption"
        sx={{ color: 'rgba(255,255,255,0.95)' }}
        label={guestCountLabel}
      />
      {guestCount > 0 ? (
        <AvatarGroup size={24} maxVisible={6} ringColor={AVATAR_GROUP_RING}>
          {guests.map((member) => (
            <DeviceAvatar
              key={member.memberId}
              avatarConfig={member.avatarConfig}
              seedFallback={member.memberId}
              size={24}
            />
          ))}
        </AvatarGroup>
      ) : null}
      <Text
        variant="caption"
        sx={{ color: 'rgba(255,255,255,0.9)' }}
        numberOfLines={1}
        label={guestNamesLabel}
      />
    </Box>
  );
}

export function SpaceCard({ space }: SpaceCardProps) {
  const { t } = useLingui();
  const router = useRouter();
  const theme = useTheme();
  const spaceCardGradientColors = [
    theme.colors.gradientPrimaryStart,
    theme.colors.gradientPrimaryEnd,
  ] as const;
  const spaceTitle = space.title;

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/space/[id]', params: { id: space.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={t`Open space ${spaceTitle}`}
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
          <LiveBadge />
        </Box>
        <GuestSummary spaceId={space.id} />
      </GradientBox>
    </Pressable>
  );
}
