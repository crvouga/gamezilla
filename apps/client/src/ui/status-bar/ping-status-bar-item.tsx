import { useServerStatus } from '@apps/client/connection/use-server-status';
import { useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { Box, RegisterStatusBarItem, Text, useTheme, WifiIcon } from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15_000;

function PingIndicator({ latencyMs }: { latencyMs: number | null }): ReactNode {
  const theme = useTheme();
  const label =
    latencyMs === null ? '—' : `${latencyMs}${String.fromCharCode(160)}ms`;
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      <WifiIcon size={12} color={theme.colors.textSecondary} />
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
    </Box>
  );
}

/**
 * Registers API health / latency into the global status bar.
 */
export function PingStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const timers = useTimers();
  const { health, aggregateStatus, refresh } = useServerStatus();

  useEffect(() => {
    const id = timers.setInterval(() => refresh(), REFRESH_INTERVAL_MS);
    return () => timers.clearInterval(id);
  }, [refresh, timers]);

  const caption =
    health.latencyMs === null ? t`Checking…` : t`${health.latencyMs} ms`;
  const onPress = useCallback(() => {
    refresh();
  }, [refresh]);

  return (
    <RegisterStatusBarItem
      id="server-ping"
      order={20}
      contentKey={`${aggregateStatus}:${health.latencyMs ?? 'na'}`}
      title={t`Server`}
      caption={caption}
      accessibilityLabel={caption}
      active={aggregateStatus === 'online'}
      indicator={<PingIndicator latencyMs={health.latencyMs} />}
      leading={<WifiIcon size={20} />}
      onPress={onPress}
    />
  );
}
