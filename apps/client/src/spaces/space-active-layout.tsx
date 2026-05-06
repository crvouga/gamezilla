import { useBreakpoint } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { SpaceActiveLayoutMobile } from './space-active-layout-mobile';
import { SpaceActiveLayoutWide } from './space-active-layout-wide';
import { groupSpaceMembers } from './space-member-grouping';
import type { SpaceMemberRow } from './types';
import { useMemberPresenceFlags } from './use-member-presence-flags';

export type SpaceActiveLayoutProps = {
  spaceTitle: string;
  members: SpaceMemberRow[];
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
  children: ReactNode;
};

function useOrderedStripMembers(
  host: SpaceMemberRow | null,
  guests: SpaceMemberRow[]
) {
  return useMemo(() => {
    const list: SpaceMemberRow[] = [];
    if (host) list.push(host);
    for (const g of guests) {
      if (!host || g.memberId !== host.memberId) list.push(g);
    }
    return list;
  }, [host, guests]);
}

export function SpaceActiveLayout({
  spaceTitle,
  members,
  isHost,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
  children,
}: SpaceActiveLayoutProps) {
  const isMobile = useBreakpoint() === 'mobile';
  const { host, guests } = useMemo(() => groupSpaceMembers(members), [members]);
  const flags = useMemberPresenceFlags(members);
  const orderedForStrip = useOrderedStripMembers(host, guests);

  if (isMobile) {
    return (
      <SpaceActiveLayoutMobile
        orderedMembers={orderedForStrip}
        host={host}
        guests={guests}
        flags={flags}
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
      spaceTitle={spaceTitle}
      host={host}
      guests={guests}
      flags={flags}
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
