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
import {
  type Command,
  GaugeIcon,
  MonitorPlayIcon,
  PaintbrushIcon,
  ScrollTextIcon,
  useRegisterCommands,
  useRouter,
  useThemePreference,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { useEmbeddedApp } from '../embedded-app-context';
import { usePerfHudPreference } from '../perf/perf-hud-preference';

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
  { href: '/ui', title: 'UI explorer' },
];

/** Super-app Harness screen (`apps/product`), a sibling of the app. */
const HARNESS_PATH = '/harness';

/** Super-app spec reports screen (`apps/product`), a sibling of the app. */
const REPORTS_PATH = '/reports';

function NavigationCommands(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
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
      run: () => {
        window.location.assign(HARNESS_PATH);
      },
    },
    {
      id: `nav:${REPORTS_PATH}`,
      title: t`Open Reports`,
      category: t`Navigation`,
      icon: ScrollTextIcon,
      keywords: [t`reports`, t`specs`, t`ci`, t`dev`],
      // Embedded actors already live inside the harness.
      visible: !embedded,
      run: () => {
        window.location.assign(REPORTS_PATH);
      },
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

export function AppCommands(): JSX.Element {
  return (
    <>
      <NavigationCommands />
      <AppearanceCommands />
      <PerformanceCommands />
    </>
  );
}
