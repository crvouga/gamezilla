/** @jsxImportSource solid-js */
/**
 * `/more/performance` — toggles the perf HUD top banner (`PerfRoot`) and
 * shows the live sampler metrics while it is on.
 */

import { Trans, useLingui } from '@lingui/solid/macro';
import { GaugeIcon, MenuRow, MenuSection, ScreenBase, Switch } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { usePerfHudPreference } from '../../shell/perf/perf-hud-preference';
import { createPerfSnapshot } from '../../shell/perf/perf-sampler-context';

const ROW_ICON_SIZE = 20;

function LiveMetrics(): JSX.Element {
  const { t } = useLingui();
  const snap = createPerfSnapshot(() => true);
  const inp = (): string => {
    const ms = snap().inpMs;
    return ms === null ? '—' : `${String(ms)} ms`;
  };

  return (
    <MenuSection
      title={<Trans>Live metrics</Trans>}
      footer={<Trans>Sampled from this tab while the monitor is on.</Trans>}
      dataSet={{ testid: 'perf-live-metrics' }}
    >
      <MenuRow title={t`Frames per second`} value={String(snap().fps)} />
      <MenuRow title={t`Interaction to next paint`} value={inp()} />
      <MenuRow title={t`Long tasks`} value={String(snap().longTaskCount)} />
      <Show when={snap().longestScript}>
        {(script) => <MenuRow title={t`Slowest script`} value={script()} />}
      </Show>
    </MenuSection>
  );
}

export function PerformanceSettingsScreen(): JSX.Element {
  const { t } = useLingui();
  const { enabled, setEnabled } = usePerfHudPreference();

  return (
    <ScreenBase
      screenId="performance"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Performance</Trans> },
      ]}
      scroll
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass} gap-5`}>
          <MenuSection
            footer={
              <Trans>
                Shows a live FPS / INP top banner. Useful for diagnosing jank on
                low-end devices. Off by default.
              </Trans>
            }
          >
            <MenuRow
              title={t`Performance monitor`}
              caption={enabled() ? t`On` : t`Off`}
              leading={<GaugeIcon size={ROW_ICON_SIZE} color="icon" />}
              trailing={
                <Switch
                  value={enabled()}
                  onValueChange={setEnabled}
                  aria-label={t`Performance monitor`}
                  dataSet={{ testid: 'perf-hud-switch' }}
                />
              }
            />
          </MenuSection>
          <Show when={enabled()}>
            <LiveMetrics />
          </Show>
        </div>
      )}
    />
  );
}
