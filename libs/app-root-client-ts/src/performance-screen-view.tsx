/** @jsxImportSource solid-js */

import type { PerfSnapshot } from '@libs/app-root-shared-ts/types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { GaugeIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { type JSX, Show } from 'solid-js';

const ROW_ICON_SIZE = 20;

function LiveMetrics(props: { readonly snap: PerfSnapshot }): JSX.Element {
  const { t } = useLingui();
  const inp = (): string => {
    const ms = props.snap.inpMs;
    return ms === null ? '—' : `${String(ms)} ms`;
  };

  return (
    <MenuSection
      title={<Trans>Live metrics</Trans>}
      footer={<Trans>Sampled from this tab while the monitor is on.</Trans>}
      dataSet={{ testid: 'perf-live-metrics' }}
    >
      <MenuRow title={t`Frames per second`} value={String(props.snap.fps)} />
      <MenuRow title={t`Interaction to next paint`} value={inp()} />
      <MenuRow title={t`Long tasks`} value={String(props.snap.longTaskCount)} />
      <Show when={props.snap.longestScript}>
        {(script) => <MenuRow title={t`Slowest script`} value={script()} />}
      </Show>
    </MenuSection>
  );
}

export type PerformanceSettingsScreenViewProps = {
  /** Whether the performance monitor banner is on. */
  readonly enabled: boolean;
  /** The latest sampled metrics; listed only while the monitor is on. */
  readonly metrics: PerfSnapshot;
  readonly onEnabledChange: (enabled: boolean) => void;
};

/**
 * `/more/performance`, presentational: the performance monitor switch and,
 * while it is on, the live sampled metrics. `PerformanceSettingsScreen` wires
 * the preference and the sampler.
 */
export function PerformanceSettingsScreenView(
  props: PerformanceSettingsScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuScreen
      screenId="performance"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Performance</Trans> },
      ]}
    >
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
          caption={props.enabled ? t`On` : t`Off`}
          leading={<GaugeIcon size={ROW_ICON_SIZE} color="icon" />}
          trailing={
            <Switch
              value={props.enabled}
              onValueChange={props.onEnabledChange}
              aria-label={t`Performance monitor`}
              dataSet={{ testid: 'perf-hud-switch' }}
            />
          }
        />
      </MenuSection>
      <Show when={props.enabled}>
        <LiveMetrics snap={props.metrics} />
      </Show>
    </MenuScreen>
  );
}
