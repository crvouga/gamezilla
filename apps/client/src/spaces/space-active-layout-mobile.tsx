import { Box, IconButton, IconSymbol, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { SpaceMembersAvatarGroup } from './space-members-avatar-group';
import { SpaceSessionChromeActions } from './space-session-chrome-actions';
import type { SpaceMemberRow } from './types';
import type { MemberPresenceFlags } from './use-member-presence-flags';

export type SpaceActiveLayoutMobileProps = {
  orderedMembers: SpaceMemberRow[];
  host: SpaceMemberRow | null;
  guests: SpaceMemberRow[];
  flags: Map<string, MemberPresenceFlags>;
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
  children: ReactNode;
};

export function SpaceActiveLayoutMobile({
  orderedMembers,
  host,
  guests,
  flags,
  isHost,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
  children,
}: SpaceActiveLayoutMobileProps) {
  const { t } = useLingui();
  const theme = useTheme();

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingVertical: 2,
          paddingHorizontal: 2,
          minHeight: 72,
          borderBottomWidth: 1,
          borderColor: 'border',
          background: 'surface',
        }}
      >
        <IconButton
          size={40}
          background="surface"
          onPress={onPressHome}
          accessibilityLabel={t`Go home`}
        >
          <IconSymbol name="house.fill" size={20} color={theme.colors.text} />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
          <SpaceMembersAvatarGroup
            orderedMembers={orderedMembers}
            host={host}
            guests={guests}
            flags={flags}
          />
        </Box>
        <SpaceSessionChromeActions
          isHost={isHost}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
          compact
        />
        <IconButton
          size={40}
          background="surface"
          onPress={onPressDebug}
          accessibilityLabel={t`Debug`}
        >
          <IconSymbol
            name="chevron.left.forwardslash.chevron.right"
            size={18}
            color={theme.colors.text}
          />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, justifyContent: 'center' }}>{children}</Box>
    </Box>
  );
}
