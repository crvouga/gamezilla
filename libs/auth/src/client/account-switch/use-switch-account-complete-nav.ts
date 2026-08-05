/**
 * After a successful account switch, leave space modals — but stay on account
 * settings / switcher and other non-space screens.
 */

import { usePathname, useRouter } from 'expo-router';
import { useCallback } from 'react';

function pathIsSpace(path: string | null): boolean {
  return path?.startsWith('/space/') ?? false;
}

function pathIsAccountSettings(path: string | null): boolean {
  return path?.startsWith('/more/account') ?? false;
}

export function useSwitchAccountCompleteNav(): () => void {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(() => {
    const windowPath =
      typeof window !== 'undefined' ? window.location.pathname : null;
    if (pathIsAccountSettings(pathname) || pathIsAccountSettings(windowPath)) {
      return;
    }
    const canDismiss = router.canDismiss();
    const onSpace = pathIsSpace(pathname) || pathIsSpace(windowPath);
    if (onSpace || canDismiss) {
      router.dismissTo('/');
    }
  }, [router, pathname]);
}
