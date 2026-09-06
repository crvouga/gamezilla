/** @jsxImportSource solid-js */
/**
 * App-wide command palette commands available in the shell: navigation and
 * appearance. Space / UI-components / performance / wipe-local-database /
 * account commands join with their screen ports (they read lib contexts that
 * are still React-bound).
 *
 * The RN dev menu (`command-palette-dev-menu.web.tsx`) is a no-op on web —
 * the palette opens via `mod+k` / `mod+shift+p` from `CommandRegistryProvider`.
 */

import { useLingui } from '@lingui/solid/macro';
import {
  type Command,
  PaintbrushIcon,
  useRegisterCommands,
  useRouter,
  useThemePreference,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

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
  { href: '/more/about', title: 'About' },
  { href: '/more/account', title: 'Account' },
  { href: '/more/sync', title: 'Sync' },
  { href: '/ui', title: 'UI explorer' },
];

function NavigationCommands(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  useRegisterCommands(() =>
    NAV_TARGETS.map(
      (node): Command => ({
        id: `nav:${node.href}`,
        title: t`Go to ${node.title}`,
        category: t`Navigation`,
        run: () => {
          router.push(node.href);
        },
      })
    )
  );
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

export function AppCommands(): JSX.Element {
  return (
    <>
      <NavigationCommands />
      <AppearanceCommands />
    </>
  );
}
