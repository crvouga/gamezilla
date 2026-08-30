import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { Box, ScreenBase, Switch, Text } from '@pkgs/ui';
import { type ReactNode, useEffect, useState } from 'react';

import { usePerfHudPreference } from '../perf/perf-hud-preference';
import { usePerfSampler } from '../perf/perf-sampler-context';
import { EMPTY_PERF_SNAPSHOT, type PerfSnapshot } from '../perf/types';

function LiveMetrics(): ReactNode {
  const sampler = usePerfSampler();
  const [snap, setSnap] = useState<PerfSnapshot>(EMPTY_PERF_SNAPSHOT);
  useEffect(() => sampler.subscribe(setSnap), [sampler]);

  const inp = snap.inpMs === null ? '—' : `${String(snap.inpMs)}ms`;

  return (
    <Box sx={{ gap: 1, mt: 2 }}>
      <Text variant="bodyBold" label={<Trans>Live metrics</Trans>} />
      <Text variant="caption" label={`FPS: ${String(snap.fps)}`} />
      <Text variant="caption" label={`INP: ${inp}`} />
      <Text
        variant="caption"
        label={`Long tasks: ${String(snap.longTaskCount)}`}
      />
      {snap.longestScript !== null ? (
        <Text
          variant="caption"
          label={`Slowest script: ${snap.longestScript}`}
        />
      ) : null}
    </Box>
  );
}

export function PerformanceSettingsScreen(): ReactNode {
  const { t } = useLingui();
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
      content={({ sx }) => (
        <Box sx={sx}>
          <Text
            variant="body"
            label={
              <Trans>
                Show a live FPS / INP overlay. Use this on low-end mobile
                browsers to diagnose jank. Off by default.
              </Trans>
            }
          />
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              mt: 3,
              gap: 2,
            }}
          >
            <Text variant="bodyBold" label={t`Performance monitor`} />
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              accessibilityLabel={t`Performance monitor`}
            />
          </Box>
          {enabled ? <LiveMetrics /> : null}
        </Box>
      )}
    />
  );
}
