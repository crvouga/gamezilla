import type { ReactNode } from 'react';

import { SpaceDetailInitialLoading } from './space-detail-initial-loading';

/** Loading view for the space detail route — keeps active-space chrome. */
export function SpaceLoadingScreen(): ReactNode {
  return <SpaceDetailInitialLoading spaceId="" />;
}
