import { Avatar, Box, Button, ScreenBase, Text } from '@gamezilla/shared/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getSpaceById } from '@/features/spaces/mock-spaces';
import type { Space } from '@/features/spaces/types';
import { useBreadcrumbNav } from '@/ui/use-breadcrumb-nav';

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
  return name.slice(0, 2) || '?';
}

export default function SpaceDetailScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const { id } = useLocalSearchParams<{ id: string }>();
  const space = typeof id === 'string' ? getSpaceById(id) : undefined;

  if (!space) {
    return (
      <ScreenBase
        breadcrumbs={[
          { name: 'Spaces', onPress: nav('/') },
          { name: 'Space' },
        ]}
        content={({ sx }) => (
          <Box
            style={sx}
            sx={{ flex: 1, justifyContent: 'center' }}
          >
            <Text
              variant="body"
              sx={{ color: 'textSecondary' }}
              label="This space could not be found."
            />
            <Box sx={{ mt: 3 }}>
              <Button
                title="Go back"
                variant="solid"
                onPress={() => router.back()}
              />
            </Box>
          </Box>
        )}
      />
    );
  }

  const participants = [
    space.host,
    { id: 'p2', displayName: 'Jamie' },
    { id: 'p3', displayName: 'Casey' },
  ];

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: space.title },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text variant="label" label={GAME_LABEL[space.gameType]} />
            {space.live ? (
              <Text variant="caption" sx={{ color: 'success' }} label="Live" />
            ) : null}
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 200,
              background: 'surface',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'border',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <Text
              variant="body"
              sx={{ color: 'textSecondary', textAlign: 'center' }}
              label="Game area (placeholder). Different game types render here."
            />
          </Box>

          <Box sx={{ gap: 2 }}>
            <Text
              variant="label"
              sx={{ color: 'textSecondary' }}
              label="People here"
            />
            <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
              {participants.map((p) => (
                <Box key={p.id} sx={{ alignItems: 'center', gap: 1 }}>
                  <Avatar
                    initials={initialsFromName(p.displayName)}
                    size={40}
                  />
                  <Text
                    variant="caption"
                    numberOfLines={1}
                    label={p.displayName}
                  />
                </Box>
              ))}
            </Box>
          </Box>

          <Button
            title="Leave space"
            variant="outlined"
            onPress={() => router.back()}
          />
        </Box>
      )}
    />
  );
}
