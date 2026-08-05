import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { releaseWebFocus } from '../../web/release-web-focus';

/**
 * Returns a stable callback factory: `nav(href)` produces an `onPress` that
 * prefers `router.back()`, otherwise `router.replace(href)`.
 */
export function useBreadcrumbNav(): (fallbackHref: Href) => () => void {
  const router = useRouter();
  return useCallback(
    (fallbackHref: Href) => () => {
      releaseWebFocus();
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace(fallbackHref as Parameters<typeof router.replace>[0]);
    },
    [router]
  );
}
