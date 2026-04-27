import { RegisterCommand } from '@gamezilla/lib/ui';
import { useMemo } from 'react';
import { useRouter, useSitemap, type Href, type SitemapType } from 'expo-router';

import {
  collectNavigableRoutes,
  dedupeNavigableRoutes,
  navCommandTitle,
} from './sitemap-nav-entries';

const NAV_CATEGORY = 'Navigation';

export function NavigationCommands() {
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
      {entries.map((node) => (
        <RegisterCommand
          key={node.contextKey}
          id={`nav:${node.contextKey}`}
          title={`Go to ${navCommandTitle(node)}`}
          category={NAV_CATEGORY}
          run={async () => {
            router.push(node.href as Href);
          }}
        />
      ))}
    </>
  );
}
