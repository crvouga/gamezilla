import { BackIconButton } from '@gamezilla/ui';
import type { ReactNode } from 'react';

import { useSpacesNavBack } from '../nav/spaces-nav-context';

/**
 * Chrome-rendered back button. Reads the registered handler from
 * {@link useSpacesNavBack}; renders nothing when no screen has registered
 * one. The "exit space" affordance lives on {@link SpaceChromeHomeButton},
 * which is always visible in the chrome.
 */
export function SpaceChromeBackButton(): ReactNode {
  const registered = useSpacesNavBack();
  if (registered === null) return null;
  return <BackIconButton onPress={registered} />;
}
