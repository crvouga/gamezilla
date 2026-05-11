import { SpaceActiveLayoutMobile } from './space-active-layout-mobile';
import { SpaceActiveLayoutWide } from './space-active-layout-wide';
import { useBreakpoint } from '@gamezilla/ui';
import type { ReactNode } from 'react';

export type SpaceActiveLayoutProps = {
  children: ReactNode;
};

/** Variant-dispatched space layout. */
export function SpaceActiveLayout({
  children,
}: SpaceActiveLayoutProps): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';

  if (isMobile) {
    return <SpaceActiveLayoutMobile>{children}</SpaceActiveLayoutMobile>;
  }
  return <SpaceActiveLayoutWide>{children}</SpaceActiveLayoutWide>;
}
