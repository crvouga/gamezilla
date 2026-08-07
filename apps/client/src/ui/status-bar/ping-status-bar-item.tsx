import { useServerStatus } from '@apps/client/connection/use-server-status';
import { useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  RegisterStatusBarItem,
  StatusDot,
  Text,
  useTheme,
  WifiIcon,
} from '@pkgs/ui';
import { type ReactNode, useEffect } from 'react';

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

function PingPanel({
  latencyMs,
  aggregateStatus,
  healthUrl,
  onRefresh,
}: {
  latencyMs: number | null;
  aggregateStatus: 'online' | 'offline' | 'warning';
  healthUrl: string;
  onRefresh: () => void;
}): ReactNode {
  const { t } = useLingui();
  const latencyLabel =
    latencyMs === null ? t`Measuring…` : t`${latencyMs} ms round-trip`;
  return (
    <Box sx={{ gap: 2 }}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <StatusDot status={aggregateStatus} size={10} />
        <Text variant="body" label={latencyLabel} />
      </Box>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={healthUrl}
      />
      <Button title={t`Refresh`} variant="outline" onPress={onRefresh} />
    </Box>
  );
}

/**
 * Registers API health / latency into the global status bar.
 */
export function PingStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const { health, healthUrl, aggregateStatus, refresh } = useServerStatus();

  useEffect(() => {
    const id = setInterval(() => refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const caption =
    health.latencyMs === null ? t`Checking server…` : t`${health.latencyMs} ms`;

  return (
    <RegisterStatusBarItem
      id="server-ping"
      order={20}
      title={t`Server`}
      caption={caption}
      accessibilityLabel={caption}
      indicator={<PingIndicator latencyMs={health.latencyMs} />}
      leading={<WifiIcon size={18} />}
      panel={
        <PingPanel
          latencyMs={health.latencyMs}
          aggregateStatus={aggregateStatus}
          healthUrl={healthUrl}
          onRefresh={refresh}
        />
      }
    />
  );
}
