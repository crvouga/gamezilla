/**
 * Leading-slot brand mark for root-tab screens. Mobile shows the mark
 * only; desktop adds the wordmark since the bar's centre is occupied by
 * {@link AppHeaderTabs} and there's room to breathe.
 */

import { AppLogo, useBreakpoint } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function AppHeaderLogo(): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';
  return <AppLogo size={28} wordmark={!isMobile} />;
}
