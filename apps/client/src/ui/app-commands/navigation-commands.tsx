import { useLingui } from '@lingui/react/macro';
import { RegisterCommand, useRouter } from '@pkgs/ui';

const NAV_TARGETS: ReadonlyArray<{
  readonly href: string;
  readonly title: string;
}> = [
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

export function NavigationCommands() {
  const { t } = useLingui();
  const router = useRouter();

  return (
    <>
      {NAV_TARGETS.map((node) => (
        <RegisterCommand
          key={node.href}
          id={`nav:${node.href}`}
          title={t`Go to ${node.title}`}
          category={t`Navigation`}
          run={async () => {
            router.push(node.href);
          }}
        />
      ))}
    </>
  );
}
