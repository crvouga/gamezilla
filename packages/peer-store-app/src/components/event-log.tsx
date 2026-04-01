import type { Event } from '@gamezilla/peer-store/types';
import { Card, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

export function EventLog({ events }: { events: Event[] }) {
  const theme = useTheme();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 1 }}>
      <Text variant="label" sx={{ mb: 1 }} style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
        Committed Events
      </Text>
      {events.length === 0 && (
        <Text variant="caption">No committed events yet.</Text>
      )}
      {events.map((event, i) => {
        const payload = event.payload as Record<string, unknown> | undefined;
        return (
          <Stack key={i} direction="horizontal" spacing={2} align="center">
            <Text
              variant="mono"
              style={{ width: 24, textAlign: 'right', fontSize: 11, color: theme.colors.textSecondary }}
            >
              {i + 1}
            </Text>
            <Text
              variant="mono"
              style={{ fontSize: 11, fontWeight: '600', color: theme.colors.success }}
            >
              {event.type}
            </Text>
            {payload && (
              <Text
                variant="mono"
                style={{ flex: 1, fontSize: 11, color: theme.colors.textSecondary }}
                numberOfLines={1}
              >
                {JSON.stringify(payload)}
              </Text>
            )}
          </Stack>
        );
      })}
    </Card>
  );
}
