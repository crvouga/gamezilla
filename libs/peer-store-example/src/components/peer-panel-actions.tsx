import { Box, Button, Stack } from '@gamezilla/lib/ui';

export type PeerAction = {
  label: string;
  color?: 'destructive' | 'warning' | 'success' | 'tint';
  active?: boolean;
  onPress: () => void;
};

export function PeerPanelActions({
  actions,
}: {
  actions?: PeerAction[] | undefined;
}) {
  const hasActions = !!actions && actions.length > 0;
  return (
    <Box sx={{ minHeight: 28 }}>
      {hasActions ? (
        <Stack direction="horizontal" spacing={2} wrap>
          {actions.map((action) => (
            <Button
              key={action.label}
              title={action.label}
              variant={action.active ? 'solid' : 'outlined'}
              size="sm"
              color={action.color ?? 'tint'}
              onPress={action.onPress}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
