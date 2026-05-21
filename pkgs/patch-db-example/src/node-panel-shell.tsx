import { Box, Card, Divider, Stack, StatusDot, Text } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui/theme';
import type { ReactNode } from 'react';

type NodePanelHeaderProps = {
  icon: ReactNode;
  title: string;
  subtitle: string | undefined;
  headerExtra: ReactNode | undefined;
  partitioned: boolean | undefined;
};

function NodePanelHeader({
  icon,
  title,
  subtitle,
  headerExtra,
  partitioned,
}: NodePanelHeaderProps) {
  const theme = useTheme();
  return (
    <Box sx={{ px: 4, py: 3 }}>
      <Stack direction="horizontal" spacing={3} align="center">
        <Box
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: partitioned
              ? theme.colors.destructive + '18'
              : theme.colors.tintMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box style={{ flex: 1 }}>
          <Stack direction="horizontal" spacing={2} align="center">
            <Text
              variant="bodyBold"
              numberOfLines={1}
              style={{ flex: 1 }}
              label={title}
            />
            <StatusDot status={partitioned ? 'offline' : 'online'} size={8} />
          </Stack>
          {subtitle ? (
            <Text
              variant="caption"
              style={{ color: theme.colors.textSecondary, marginTop: 2 }}
              label={subtitle}
            />
          ) : null}
        </Box>
        {headerExtra}
      </Stack>
    </Box>
  );
}

export function NodePanelShell({
  icon,
  title,
  subtitle,
  headerExtra,
  partitioned,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  partitioned?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card
      elevation={partitioned ? 0 : 2}
      style={
        partitioned
          ? {
              borderWidth: 1,
              borderColor: theme.colors.destructive + '55',
              backgroundColor: theme.colors.surface,
              opacity: 0.85,
            }
          : undefined
      }
    >
      <NodePanelHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        headerExtra={headerExtra}
        partitioned={partitioned}
      />
      <Divider />
      <Box sx={{ p: 4 }}>{children}</Box>
    </Card>
  );
}
