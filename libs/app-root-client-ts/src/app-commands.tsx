/** @jsxImportSource solid-js */
/**
 * App-wide command palette commands available in the shell: navigation,
 * appearance, and the performance HUD toggle. Space / UI-components /
 * wipe-local-database / account commands join with their screen ports (they
 * read lib contexts that are still UI-bound).
 *
 * The RN dev menu (`command-palette-dev-menu.web.tsx`) is a no-op on web —
 * the palette opens via `mod+k` / `mod+shift+p` from `CommandRegistryProvider`.
 */

import { useLingui } from '@lingui/solid/macro';
import { feedbackCommand } from '@pkgs/feedback-client-ts/feedback-command';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useOpenExternalUrl } from '@pkgs/ui-root-client-ts/external-url';
import {
  GaugeIcon,
  MonitorPlayIcon,
  PaintbrushIcon,
  WifiIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { useRegisterCommands } from '@pkgs/ui-root-client-ts/register-command';
import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { Command } from '@pkgs/ui-root-client-ts/types';
import type { JSX } from 'solid-js';

import { useEmbeddedApp } from './embedded-app-context';
import { useOfflinePreference } from './offline-preference';
import { usePerfHudPreference } from './perf-hud-preference';

const NAV_TARGETS: readonly {
  readonly href: string;
  readonly title: string;
}[] = [
  { href: '/', title: 'Spaces' },
  { href: '/search', title: 'Search' },
  { href: '/notifications', title: 'Notifications' },
  { href: '/profile', title: 'Profile' },
  { href: '/more', title: 'Settings' },
  { href: '/more/theme', title: 'Theme' },
  { href: '/more/performance', title: 'Performance' },
  { href: '/more/about', title: 'About' },
  { href: '/more/account', title: 'Account' },
  { href: '/more/billing', title: 'Billing' },
  { href: '/more/sync', title: 'Sync' },
  { href: '/client/sql', title: 'Client SQL' },
  { href: '/client/events', title: 'Client events' },
];

/** Super-app Harness screen (`apps/product-ts`), a sibling of the app. */
const HARNESS_PATH = '/harness';

function NavigationCommands(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const openExternalUrl = useOpenExternalUrl();
  const embedded = useEmbeddedApp();
  useRegisterCommands(() => [
    ...NAV_TARGETS.map(
      (node): Command => ({
        id: `nav:${node.href}`,
        title: t`Go to ${node.title}`,
        category: t`Navigation`,
        run: () => {
          router.push(node.href);
        },
      })
    ),
    {
      id: `nav:${HARNESS_PATH}`,
      title: t`Open Harness`,
      category: t`Navigation`,
      icon: MonitorPlayIcon,
      keywords: [t`harness`, t`harness`, t`dev`, t`debug`],
      // Embedded actors already live inside the harness.
      visible: !embedded,
      run: () => openExternalUrl(HARNESS_PATH),
    },
  ]);
  return null;
}

function AppearanceCommands(): JSX.Element {
  const { t } = useLingui();
  const { setPreference } = useThemePreference();
  useRegisterCommands(() => [
    {
      id: 'theme-light',
      title: t`Use light theme`,
      category: t`Appearance`,
      icon: PaintbrushIcon,
      keywords: [t`light`, t`day`, t`bright`],
      run: () => setPreference('light'),
    },
    {
      id: 'theme-dark',
      title: t`Use dark theme`,
      category: t`Appearance`,
      icon: PaintbrushIcon,
      keywords: [t`dark`, t`night`],
      run: () => setPreference('dark'),
    },
    {
      id: 'theme-system',
      title: t`Use system theme`,
      category: t`Appearance`,
      icon: PaintbrushIcon,
      keywords: [t`system`, t`auto`, t`os`],
      run: () => setPreference('system'),
    },
  ]);
  return null;
}

function PerformanceCommands(): JSX.Element {
  const { t } = useLingui();
  const { enabled, setEnabled } = usePerfHudPreference();
  useRegisterCommands(() => [
    {
      id: 'perf-hud-show',
      title: t`Show performance monitor`,
      category: t`Developer`,
      icon: GaugeIcon,
      keywords: [t`fps`, t`inp`, t`jank`, t`hud`, t`perf`],
      visible: !enabled(),
      run: () => setEnabled(true),
    },
    {
      id: 'perf-hud-hide',
      title: t`Hide performance monitor`,
      category: t`Developer`,
      icon: GaugeIcon,
      keywords: [t`fps`, t`inp`, t`jank`, t`hud`, t`perf`],
      visible: enabled(),
      run: () => setEnabled(false),
    },
  ]);
  return null;
}

function FeedbackCommands(): JSX.Element {
  const { t } = useLingui();
  useRegisterCommands(() => [
    feedbackCommand({
      title: t`Open developer feedback`,
      category: t`Developer`,
    }),
  ]);
  return null;
}

function NetworkCommands(): JSX.Element {
  const { t } = useLingui();
  const { offline, setOffline } = useOfflinePreference();
  useRegisterCommands(() => [
    {
      id: 'network-work-offline',
      title: t`Work offline`,
      category: t`Connectivity`,
      icon: WifiOffIcon,
      keywords: [t`offline`, t`disconnect`, t`network`],
      visible: !offline(),
      run: () => setOffline(true),
    },
    {
      id: 'network-work-online',
      title: t`Work online`,
      category: t`Connectivity`,
      icon: WifiIcon,
      keywords: [t`online`, t`connect`, t`network`],
      visible: offline(),
      run: () => setOffline(false),
    },
  ]);
  return null;
}

export function AppCommands(): JSX.Element {
  return (
    <>
      <NavigationCommands />
      <AppearanceCommands />
      <PerformanceCommands />
      <NetworkCommands />
      <FeedbackCommands />
    </>
  );
}
