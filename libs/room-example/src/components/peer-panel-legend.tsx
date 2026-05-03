import { Stack, StatusDot, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export function PeerPanelLegend({ hasOptimistic }: { hasOptimistic: boolean }) {
  const { t } = useLingui();
  return (
    <Stack direction="horizontal" spacing={3} align="center">
      <Stack direction="horizontal" spacing={1} align="center">
        <StatusDot status="online" size={8} />
        <Text variant="caption" label={t`committed`} />
      </Stack>
      {hasOptimistic && (
        <Stack direction="horizontal" spacing={1} align="center">
          <StatusDot status="warning" size={8} />
          <Text variant="caption" label={t`optimistic`} />
        </Stack>
      )}
    </Stack>
  );
}
