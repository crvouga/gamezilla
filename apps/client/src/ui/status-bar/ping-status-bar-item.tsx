import { useServerStatus } from '@apps/client/connection/use-server-status';
import { useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { useOptionalOriginAvailability } from '@pkgs/http-client';
import {
  Box,
  RegisterStatusBarItem,
  Text,
  useOnColor,
  useRouter,
  useStatusBar,
  WifiIcon,
} from '@pkgs/ui';
import { type ReactNode, useCallback, useEffect } from 'react';

const REFRESH_INTERVAL_MS = 15_000;

function PingIndicator({ latencyMs }: { latencyMs: number | null }): ReactNode {
  const onColor = useOnColor();
  const label =
    latencyMs === null ? '—' : `${latencyMs}${String.fromCharCode(160)}ms`;
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      <WifiIcon size={12} color={onColor.icon} />
      <Text variant="caption" sx={{ color: onColor.fgMuted }} label={label} />
    </Box>
  );
}

/**
 * Registers API health / latency into the global status bar.
 */
export function PingStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { close } = useStatusBar();
  const timers = useTimers();
  const availability = useOptionalOriginAvailability();
  const { health, aggregateStatus, refresh } = useServerStatus();

  useEffect(() => {
    if (availability?.kind !== 'health') return;
    if (health.phase !== 'success') return;
    const id = timers.setInterval(() => refresh(), REFRESH_INTERVAL_MS);
    return () => timers.clearInterval(id);
  }, [availability, health.phase, refresh, timers]);

  const caption =
    health.latencyMs === null ? t`Checking…` : t`${health.latencyMs} ms`;
  const onPress = useCallback(() => {
    close();
    router.push('/more/server-status');
  }, [close, router]);

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
