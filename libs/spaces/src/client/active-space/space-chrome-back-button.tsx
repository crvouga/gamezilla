import { BackIconButton } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSpacesNavBack } from '../nav/spaces-nav-context';

/**
 * Chrome-rendered back button. Reads the registered handler from
 * {@link useSpacesNavBack}; renders nothing when no screen has registered
 * one. The always-visible exit affordance is {@link SpaceChromeHomeButton}
 * in the same leading cluster.
 */
export function SpaceChromeBackButton(): ReactNode {
  const registered = useSpacesNavBack();
  if (registered === null) return null;
  return <BackIconButton size={36} onPress={registered} />;
}
