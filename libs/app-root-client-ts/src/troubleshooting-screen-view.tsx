/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  GaugeIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  WifiIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { Href } from '@pkgs/ui-root-shared-ts/href';
import { type Accessor, For, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

const ROW_ICON_SIZE = 20;

type TroubleshootingRow = {
  readonly title: string;
  readonly caption: string;
  readonly value?: string | undefined;
  readonly icon: IconComponent;
  readonly href: Href;
  readonly testid: string;
};

export type TroubleshootingScreenViewProps = {
  /** Whether the performance monitor is on, shown on its row. */
  readonly perfEnabled: boolean;
  /** Open a diagnostics screen. */
  readonly onNavigate: (href: Href) => void;
};

function useTroubleshootingRows(
  props: TroubleshootingScreenViewProps
): Accessor<readonly TroubleshootingRow[]> {
  const { t } = useLingui();
  return () => [
    {
      title: t`Connection`,
      caption: t`Status, and what works offline`,
      icon: WifiIcon,
      href: '/more/server-status',
      testid: Handles.settingsConnection,
    },
    {
      title: t`Sync`,
      caption: t`Changes waiting to send`,
      icon: RefreshCwIcon,
      href: '/more/sync',
      testid: 'settings-sync',
    },
    {
      title: t`Client config`,
      caption: t`Settings from the server`,
      icon: SlidersHorizontalIcon,
      href: '/more/client-config',
      testid: 'settings-client-config',
    },
    {
      title: t`Performance`,
      caption: t`Frame rate and responsiveness`,
      value: props.perfEnabled ? t`On` : t`Off`,
      icon: GaugeIcon,
      href: '/more/performance',
      testid: 'settings-performance',
    },
  ];
}

/**
 * `/more/troubleshooting`, presentational: the diagnostics to check when
 * something is not working (connection, sync, client config, performance),
 * one page each. Settings links here like every other row, so a right
 * chevron always opens a page. `TroubleshootingScreen` wires navigation and
 * the performance preference.
 */
export function TroubleshootingScreenView(
  props: TroubleshootingScreenViewProps
): JSX.Element {
  const rows = useTroubleshootingRows(props);
  return (
    <MenuScreen
      screenId="more-troubleshooting"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Troubleshooting</Trans> },
      ]}
    >
      <MenuSection
        footer={<Trans>Details to check when something isn't working.</Trans>}
      >
        <For each={rows()}>
          {(row) => (
            <MenuRow
              title={row.title}
              caption={row.caption}
              value={row.value}
              leading={
                <Dynamic
                  component={row.icon}
                  size={ROW_ICON_SIZE}
                  color="icon"
                />
              }
              href={row.href}
              onClick={() => props.onNavigate(row.href)}
              dataSet={{ testid: row.testid }}
            />
          )}
        </For>
      </MenuSection>
    </MenuScreen>
  );
}
