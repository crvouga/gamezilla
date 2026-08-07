import { useLingui } from '@lingui/react/macro';
import { RegisterCommand } from '@pkgs/ui';
import {
  type Href,
  type SitemapType,
  useRouter,
  useSitemap,
} from 'expo-router';
import { useMemo } from 'react';

import {
  collectNavigableRoutes,
  dedupeNavigableRoutes,
  navCommandTitle,
} from './sitemap-nav-entries';

export function NavigationCommands() {
  const { t } = useLingui();
  const router = useRouter();
  const sitemap = useSitemap();

  const entries = useMemo(() => {
    if (!sitemap) return [];
    const collected: SitemapType[] = [];
    for (const child of sitemap.children) {
      collectNavigableRoutes(child, collected);
    }
    return dedupeNavigableRoutes(collected);
  }, [sitemap]);

  return (
    <>
      {entries.map((node) => {
        const target = navCommandTitle(node);
        return (
          <RegisterCommand
            key={node.contextKey}
            id={`nav:${node.contextKey}`}
            title={t`Go to ${target}`}
            category={t`Navigation`}
            run={async () => {
              router.push(node.href as Href);
            }}
          />
        );
      })}
    </>
  );
}
