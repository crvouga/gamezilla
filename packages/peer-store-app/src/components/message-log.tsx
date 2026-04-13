import type { MessageLogEntry } from '../simulator/playground';
import { Card, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

const KIND_COLORS: Record<string, string> = {
  command: '#7dd3fc',
  vote: '#fcd34d',
  commit: '#6ee7b7',
  timeout: '#fca5a5',
  error: '#999',
  cheat: '#f472b6',
};

export function MessageLog({ entries }: { entries: MessageLogEntry[] }) {
  const theme = useTheme();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 1 }}>
      <Text
        variant="label"
        sx={{ mb: 1 }}
        style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
        label="Message Log"
      />
      {entries.length === 0 && (
        <Text variant="caption" label="No messages yet." />
      )}
      {entries.map((entry) => (
        <Stack key={entry.id} direction="horizontal" spacing={2} align="center">
          <Text
            variant="mono"
            style={{
              width: 64,
              fontSize: 11,
              color: theme.colors.textSecondary,
            }}
            numberOfLines={1}
            label={entry.from}
          />
          <Text
            variant="mono"
            style={{
              width: 56,
              fontSize: 11,
              fontWeight: '600',
              color: KIND_COLORS[entry.kind] ?? theme.colors.textSecondary,
            }}
            numberOfLines={1}
            label={entry.kind}
          />
          <Text
            variant="mono"
            style={{ flex: 1, fontSize: 11, color: theme.colors.textSecondary }}
            numberOfLines={1}
            label={entry.summary}
          />
        </Stack>
      ))}
    </Card>
  );
}
