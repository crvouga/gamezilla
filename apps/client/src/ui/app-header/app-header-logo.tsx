/**
 * Leading-slot brand mark for root-tab screens.
 */

import { AppLogo } from '@pkgs/ui';
import type { ReactNode } from 'react';

export function AppHeaderLogo(): ReactNode {
  return <AppLogo size={28} wordmark={false} />;
}
