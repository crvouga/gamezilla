import type { Event } from '@gamezilla/room/types';
import { Card, Stack, Text } from '@gamezilla/lib/ui';
import { useTheme } from '@gamezilla/lib/ui/theme';
import { useLingui } from '@lingui/react/macro';

export function EventLog({ events }: { events: Event[] }) {
  const theme = useTheme();
  const { t } = useLingui();

  return (
    <Card elevation={1} sx={{ p: 4, gap: 1 }}>
      <Text
        variant="label"
        sx={{ mb: 1 }}
        style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
        label={t`Committed Events`}
      />
      {events.length === 0 && (
        <Text variant="caption" label={t`No committed events yet.`} />
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
