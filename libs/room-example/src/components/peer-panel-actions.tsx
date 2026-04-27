import { Box, Button, Stack } from '@gamezilla/lib/ui';

export type PeerAction = {
  label: string;
  color?: 'destructive' | 'warning' | 'success' | 'tint';
  active?: boolean;
  visible?: boolean;
  enabled?: boolean;
  reason?: string;
  onPress: () => void;
};

export function PeerPanelActions({
  actions,
}: {
  actions?: PeerAction[] | undefined;
}) {
  const visibleActions = (actions ?? []).filter((action) => action.visible !== false);
  const hasActions = visibleActions.length > 0;
  return (
    <Box sx={{ minHeight: 28 }}>
      {hasActions ? (
        <Stack direction="horizontal" spacing={2} wrap>
          {visibleActions.map((action) => (
            <Button
              key={action.label}
              title={
                action.enabled === false && action.reason
                  ? `${action.label} (${action.reason})`
                  : action.label
              }
              variant={action.active ? 'solid' : 'outlined'}
              size="sm"
              color={action.color ?? 'tint'}
              disabled={action.enabled === false}
              onPress={action.onPress}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
