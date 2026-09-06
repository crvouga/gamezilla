import { useLingui } from '@lingui/react/macro';
import { MonitorIcon, RegisterCommand } from '@pkgs/ui-rn';

import { usePerfHudPreference } from '../../perf/perf-hud-preference';

export function PerformanceCommands() {
  const { t } = useLingui();
  const { enabled, setEnabled } = usePerfHudPreference();
  return (
    <>
      <RegisterCommand
        id="perf-hud-show"
        title={t`Show performance monitor`}
        category={t`Performance`}
        icon={MonitorIcon}
        keywords={[t`fps`, t`inp`, t`performance`, t`jank`]}
        run={async () => {
          setEnabled(true);
        }}
      />
      {enabled ? (
        <RegisterCommand
          id="perf-hud-hide"
          title={t`Hide performance monitor`}
          category={t`Performance`}
          icon={MonitorIcon}
          keywords={[t`fps`, t`inp`, t`performance`]}
          run={async () => {
            setEnabled(false);
          }}
        />
      ) : null}
    </>
  );
}
