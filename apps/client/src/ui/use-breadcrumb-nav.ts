import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Returns a stable callback factory: `nav(href)` produces an `onPress` that
 * prefers `router.back()`, otherwise `router.replace(href)`.
 */
export function useBreadcrumbNav() {
  const router = useRouter();
  return useCallback(
    (fallbackHref: Href) => () => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace(fallbackHref);
    },
    [router]
  );
}
