import { Stack, StatusDot, Text } from '@gamezilla/lib/ui';

export function PeerPanelLegend({
  hasOptimistic,
}: {
  hasOptimistic: boolean;
}) {
  return (
    <Stack direction="horizontal" spacing={3} align="center">
      <Stack direction="horizontal" spacing={1} align="center">
        <StatusDot status="online" size={8} />
        <Text variant="caption" label="committed" />
      </Stack>
      {hasOptimistic && (
        <Stack direction="horizontal" spacing={1} align="center">
          <StatusDot status="warning" size={8} />
          <Text variant="caption" label="optimistic" />
        </Stack>
      )}
    </Stack>
  );
}
