import type { JSX } from 'solid-js';

import { SpaceDetailInitialLoading } from './space-detail-initial-loading';

/** Loading view for the space detail route — keeps active-space chrome. */
export function SpaceLoadingScreen(): JSX.Element {
  return <SpaceDetailInitialLoading spaceId="" />;
}
