/**
 * `IslandGrid` -- stacks children on compact; wrapping multi-column grid on
 * wide. Column span comes from each {@link Island}'s `span` prop.
 */

import type { ReactNode } from 'react';
import { useLayoutMode } from '../../theme/use-layout-mode';
import { IslandGridCompact } from './island-grid.compact';
import { IslandGridWide } from './island-grid.wide';
import type { IslandGridProps } from './island-grid-types';

export type { IslandGridColumns, IslandGridProps } from './island-grid-types';

export function IslandGrid(props: IslandGridProps): ReactNode {
  const mode = useLayoutMode();
  if (mode === 'wide') {
    return <IslandGridWide {...props} />;
  }
  return <IslandGridCompact {...props} />;
}
