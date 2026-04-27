import type { Event } from '@gamezilla/peer-store/types';
import { Card, Stack, Text } from '@gamezilla/lib/ui';
import { useTheme } from '@gamezilla/lib/ui/theme';

export function EventLog({ events }: { events: Event[] }) {
  const theme = useTheme();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 1 }}>
      <Text
        variant="label"
        sx={{ mb: 1 }}
        style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
        label="Committed Events"
      />
      {events.length === 0 && (
        <Text variant="caption" label="No committed events yet." />
      )}
      {events.map((event, i) => {
        const raw = event.payload;
        const payload =
          raw !== null &&
          typeof raw === 'object' &&
          !Array.isArray(raw)
            ? raw
            : undefined;
        return (
          <Stack key={i} direction="horizontal" spacing={2} align="center">
            <Text
              variant="mono"
              style={{
                width: 24,
                textAlign: 'right',
                fontSize: 11,
                color: theme.colors.textSecondary,
              }}
              label={String(i + 1)}
            />
            <Text
              variant="mono"
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: theme.colors.success,
              }}
              label={event.type}
            />
            {payload && (
              <Text
                variant="mono"
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: theme.colors.textSecondary,
                }}
                numberOfLines={1}
                label={JSON.stringify(payload)}
              />
            )}
          </Stack>
        );
      })}
    </Card>
  );
}
