import { BackIconButton } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSpacesNavBack } from '../nav/spaces-nav-context';

/**
 * Chrome-rendered back button. Reads the registered handler from
 * {@link useSpacesNavBack}; renders nothing when no screen has registered
 * one. The "exit space" affordance lives on {@link SpaceChromeActionBar},
 * which keeps home visible and collapses the rest when space is tight.
 */
export function SpaceChromeBackButton(): ReactNode {
  const registered = useSpacesNavBack();
  if (registered === null) return null;
  return <BackIconButton onPress={registered} />;
}
