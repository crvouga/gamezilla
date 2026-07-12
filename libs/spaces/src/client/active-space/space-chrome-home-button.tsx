import { DoorOpenIcon, IconButton, useTheme } from '@pkgs/ui';
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
      size={36}
      label={t`Go to spaces`}
      onPress={onPressHome}
    >
      <DoorOpenIcon size={18} color={theme.colors.icon} />
    </IconButton>
  );
}
