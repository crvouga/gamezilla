/**
 * Breadcrumb back: prefer pop, else replace to fallback path.
 *
 * Returns a callback factory: `nav(href)` produces an `onClick` that prefers
 * `router.back()`, otherwise `router.replace(href)`.
 */

import { type Href, useRouter } from '../../navigation';
import { releaseWebFocus } from '../../web';

export function useBreadcrumbNav(): (fallbackHref: Href) => () => void {
  const router = useRouter();
  return (fallbackHref) => () => {
    releaseWebFocus();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };
}
