import { IconButton, IconSymbol, useTheme } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceSessionUi } from './space-session-ui-context';

/**
 * Always-visible "exit to spaces home" affordance. Renders independently
 * of the per-screen back registration so users can leave the space chrome
 * from any nested screen without opening the overflow menu.
 */
export function SpaceChromeHomeButton(): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const { onPressHome } = useSpaceSessionUi();
  return (
    <IconButton
      size={40}
      background="surface"
      onPress={onPressHome}
      accessibilityLabel={t`Go to spaces`}
    >
      <IconSymbol name="house.fill" size={18} color={theme.colors.icon} />
    </IconButton>
  );
}
