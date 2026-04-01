import type { ReactNode } from 'react';
import { Box, Card, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

export function NodePanelShell({
  icon,
  title,
  headerExtra,
  partitioned,
  children,
}: {
  icon: ReactNode;
  title: string;
  headerExtra?: ReactNode;
  partitioned?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <Card
      elevation={2}
      style={partitioned ? { borderWidth: 1, borderColor: theme.colors.destructive + '66' } : undefined}
    >
      <Stack
        direction="horizontal"
        spacing={2}
        align="center"
        sx={{ px: 3, py: 2 }}
        style={{
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Box>{icon}</Box>
        <Text variant="mono" sx={{ fontSize: 'sm' }} style={{ fontWeight: '600', flex: 1 }}>
          {title}
        </Text>
        {headerExtra}
      </Stack>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Card>
  );
}
