import { Card, Stack, Text, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { CheatLogEntry } from '../simulator/playground';

export function CheatLog({ entries }: { entries: CheatLogEntry[] }) {
  const theme = useTheme();
  const { t } = useLingui();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 1 }}>
      <Text
        variant="label"
        sx={{ mb: 1 }}
        style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
        label={t`Cheat Log`}
      />
      {entries.length === 0 && (
        <Text variant="caption" label={t`No cheat attempts yet.`} />
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
            label={entry.detected ? 'CAUGHT' : 'UNDETECTED'}
          />
          {entry.peerId && (
            <Text
              variant="mono"
              sx={{
                width: 72,
                fontSize: 11,
                color: entry.peerId === 'wire' ? '#facc15' : theme.colors.text,
              }}
              numberOfLines={1}
              label={entry.peerId}
            />
          )}
          <Text
            variant="mono"
            sx={{
              width: 100,
              fontSize: 11,
              color: theme.colors.textSecondary,
            }}
            numberOfLines={1}
            label={entry.scenario}
          />
          <Text
            variant="mono"
            sx={{
              flex: 1,
              fontSize: 11,
              color: theme.colors.textSecondary,
            }}
            numberOfLines={1}
            label={entry.detail}
          />
        </Stack>
      ))}
    </Card>
  );
}
