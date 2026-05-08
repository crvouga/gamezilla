import { SpaceMembersAvatarGroup } from '@gamezilla/client/spaces/members/space-members-avatar-group';
import { SpaceSessionChromeActions } from '@gamezilla/client/spaces/layout/space-session-chrome-actions';
import { useSpaceSessionUi } from '@gamezilla/client/spaces/layout/space-session-ui-context';
import { Box, IconButton, IconSymbol, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceActiveLayoutMobileProps = {
  children: ReactNode;
};

export function SpaceActiveLayoutMobile({
  children,
}: SpaceActiveLayoutMobileProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const { spaceId, onPressHome, onPressDebug } = useSpaceSessionUi();

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          py: 2,
          px: 3,
          minHeight: 64,
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
          <SpaceMembersAvatarGroup spaceId={spaceId} />
        </Box>
        <SpaceSessionChromeActions compact />
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
      <Box sx={{ flex: 1, minHeight: 0, justifyContent: 'flex-start' }}>
        {children}
      </Box>
    </Box>
  );
}
