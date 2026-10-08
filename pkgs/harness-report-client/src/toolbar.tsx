import { useLingui } from '@lingui/solid/macro';
import {
  showAside,
  showPress,
  viewMode,
  zoomMode,
} from '@pkgs/harness-report-shared/hash';
import { Checkbox } from '@pkgs/ui-root-client/checkbox';
import { SegmentedControl } from '@pkgs/ui-root-client/segmented-control';
import { Show } from 'solid-js';
import type { ReportNav } from './use-report-nav';

export function Toolbar(props: {
  nav: ReportNav;
  ui: boolean;
  hasData: boolean;
}) {
  const { t } = useLingui();
  const route = () => props.nav.route();
  return (
    <Show when={props.ui}>
      <div class="box flex-row flex-wrap items-center gap-3 px-3 py-2 bg-surface border-b border-border">
        <SegmentedControl
          aria-label={t`Clients`}
          segments={[
            { key: 'multi', label: t`All clients` },
            { key: 'single', label: t`Focused` },
          ]}
          selected={viewMode(route())}
          onSelect={(mode) =>
            props.nav.setParam('view', mode === 'multi' ? '' : mode)
          }
        />
        <SegmentedControl
          aria-label={t`Zoom`}
          segments={['fit', '50', '75', '100'].map((key) => ({
            key,
            label: key === 'fit' ? t`Fit` : `${key}%`,
          }))}
          selected={zoomMode(route())}
          onSelect={(zoom) =>
            props.nav.setParam('zoom', zoom === 'fit' ? '' : zoom)
          }
        />
        <Checkbox
          checked={showPress(route())}
          label={t`Highlight press`}
          onToggle={(checked) =>
            props.nav.setParam('press', checked ? '' : '0')
          }
        />
        <Show when={props.hasData}>
          <Checkbox
            checked={showAside(route())}
            label={t`State`}
            onToggle={(checked) => {
              props.nav.setParam('aside', checked ? '' : '0');
              props.nav.setParam('inspect', checked ? 'state' : '');
            }}
          />
        </Show>
      </div>
    </Show>
  );
}
