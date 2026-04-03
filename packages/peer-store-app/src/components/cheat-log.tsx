import { Card, Stack, Text, useTheme } from '@gamezilla/shared/ui';
import type { CheatLogEntry } from '../simulator/playground';

export function CheatLog({ entries }: { entries: CheatLogEntry[] }) {
  const theme = useTheme();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 1 }}>
      <Text
        variant="label"
        sx={{ mb: 1 }}
        style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
      >
        Cheat Log
      </Text>
      {entries.length === 0 && (
        <Text variant="caption">No cheat attempts yet.</Text>
      )}
      {entries.map((entry) => (
        <Stack key={entry.id} direction="horizontal" spacing={2} align="center">
          <Text
            variant="mono"
            sx={{
              width: 80,
              fontSize: 11,
              fontWeight: '600',
              color: entry.detected ? '#6ee7b7' : '#fca5a5',
            }}
            numberOfLines={1}
          >
            {entry.detected ? 'CAUGHT' : 'UNDETECTED'}
          </Text>
          {entry.peerId && (
            <Text
              variant="mono"
              sx={{
                width: 72,
                fontSize: 11,
                color: entry.peerId === 'wire' ? '#facc15' : theme.colors.text,
              }}
              numberOfLines={1}
            >
              {entry.peerId}
            </Text>
          )}
          <Text
            variant="mono"
            sx={{
              width: 100,
              fontSize: 11,
              color: theme.colors.textSecondary,
            }}
            numberOfLines={1}
          >
            {entry.scenario}
          </Text>
          <Text
            variant="mono"
            sx={{
              flex: 1,
              fontSize: 11,
              color: theme.colors.textSecondary,
            }}
            numberOfLines={1}
          >
            {entry.detail}
          </Text>
        </Stack>
      ))}
    </Card>
  );
}
