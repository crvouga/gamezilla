/**
 * Breadcrumb back: prefer pop, else replace to fallback path.
 */

import { useCallback } from 'react';
import { type Href, useRouter } from '../../navigation/app-router';
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
      router.replace(fallbackHref);
    },
    [router]
  );
}
