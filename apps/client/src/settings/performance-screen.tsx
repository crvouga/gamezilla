import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  GaugeIcon,
  MenuRow,
  MenuSection,
  ScreenBase,
  Switch,
  useTheme,
} from '@pkgs/ui';
import { type ReactNode, useEffect, useState } from 'react';

import { usePerfHudPreference } from '../perf/perf-hud-preference';
import { usePerfSampler } from '../perf/perf-sampler-context';
import { EMPTY_PERF_SNAPSHOT, type PerfSnapshot } from '../perf/types';

const ROW_ICON_SIZE = 20;

function LiveMetrics(): ReactNode {
  const { t } = useLingui();
  const sampler = usePerfSampler();
  const [snap, setSnap] = useState<PerfSnapshot>(EMPTY_PERF_SNAPSHOT);
  useEffect(() => sampler.subscribe(setSnap), [sampler]);

  const inp = snap.inpMs === null ? '—' : `${String(snap.inpMs)} ms`;

  return (
    <MenuSection
      title={<Trans>Live metrics</Trans>}
      footer={<Trans>Sampled from this tab while the monitor is on.</Trans>}
    >
      <MenuRow title={t`Frames per second`} value={String(snap.fps)} />
      <MenuRow title={t`Interaction to next paint`} value={inp} />
      <MenuRow title={t`Long tasks`} value={String(snap.longTaskCount)} />
      {snap.longestScript !== null ? (
        <MenuRow title={t`Slowest script`} value={snap.longestScript} />
      ) : null}
    </MenuSection>
  );
}

export function PerformanceSettingsScreen(): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const nav = useBreadcrumbNav();
  const { enabled, setEnabled } = usePerfHudPreference();

  return (
    <ScreenBase
      screenId="performance"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Performance</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <MenuSection
            footer={
              <Trans>
                Shows a live FPS / INP overlay. Useful for diagnosing jank on
                low-end devices. Off by default.
              </Trans>
            }
          >
            <MenuRow
              title={t`Performance monitor`}
              caption={enabled ? t`On` : t`Off`}
              leading={
                <GaugeIcon size={ROW_ICON_SIZE} color={theme.colors.icon} />
              }
              trailing={
                <Switch
                  value={enabled}
                  onValueChange={setEnabled}
                  accessibilityLabel={t`Performance monitor`}
                />
              }
            />
          </MenuSection>
          {enabled ? <LiveMetrics /> : null}
        </Box>
      )}
    />
  );
}
