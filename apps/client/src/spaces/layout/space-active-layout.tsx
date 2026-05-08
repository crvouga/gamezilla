import { SpaceActiveLayoutMobile } from '@gamezilla/client/spaces/space-active-layout-mobile';
import { SpaceActiveLayoutWide } from '@gamezilla/client/spaces/space-active-layout-wide';
import { useBreakpoint } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type SpaceActiveLayoutProps = {
  spaceId: string;
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
  children: ReactNode;
};

/** Variant-dispatched space layout. */
export function SpaceActiveLayout({
  spaceId,
  isHost,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
  children,
}: SpaceActiveLayoutProps): ReactNode {
  const isMobile = useBreakpoint() === 'mobile';

  if (isMobile) {
    return (
      <SpaceActiveLayoutMobile
        spaceId={spaceId}
        isHost={isHost}
        onRequestEnd={onRequestEnd}
        onRequestLeave={onRequestLeave}
        onPressHome={onPressHome}
        onPressDebug={onPressDebug}
      >
        {children}
      </SpaceActiveLayoutMobile>
    );
  }
  return (
    <SpaceActiveLayoutWide
      spaceId={spaceId}
      isHost={isHost}
      onRequestEnd={onRequestEnd}
      onRequestLeave={onRequestLeave}
      onPressHome={onPressHome}
      onPressDebug={onPressDebug}
    >
      {children}
    </SpaceActiveLayoutWide>
  );
}
