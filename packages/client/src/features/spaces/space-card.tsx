import {
  Avatar,
  Box,
  GradientBox,
  Pressable,
  StatusDot,
  Text,
  useTheme,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';

import type { Space } from './types';

const GAME_LABEL: Record<Space['gameType'], string> = {
  trivia: 'Trivia',
  drawing: 'Drawing',
  'word-guess': 'Word guess',
  party: 'Party',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
  }
  return (name.slice(0, 2) || '?').toUpperCase();
}

export type SpaceCardProps = {
  space: Space;
};

export function SpaceCard({ space }: SpaceCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const spaceCardGradientColors = [
    theme.colors.gradientPrimaryStart,
    theme.colors.tint,
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
          <Box
            sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 }}
          >
            <Avatar
              initials={initialsFromName(space.host.displayName)}
              size={44}
              background="rgba(255,255,255,0.22)"
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
                label={space.host.displayName}
              />
            </Box>
          </Box>
          {space.live ? (
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
          ) : (
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
                label="Soon"
              />
            </Box>
          )}
        </Box>

        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 3,
          }}
        >
          <Text
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.95)' }}
            label={GAME_LABEL[space.gameType]}
          />
          <Text
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.9)' }}
            label={`${space.listenerCount} listening`}
          />
        </Box>
      </GradientBox>
    </Pressable>
  );
}
