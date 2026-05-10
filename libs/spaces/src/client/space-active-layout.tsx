import { SpaceActiveLayoutMobile } from '@gamezilla/client/spaces/layout/space-active-layout-mobile';
import { SpaceActiveLayoutWide } from '@gamezilla/client/spaces/layout/space-active-layout-wide';
import { useBreakpoint } from '@gamezilla/lib/ui';
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
