/**
 * `Island` -- self-contained card on desktop; children-only passthrough on
 * compact so existing mobile compositions stay unchanged when wrapped.
 */

import type { ReactNode } from 'react';
import { useLayoutMode } from '../../theme/use-layout-mode';
import { IslandCompact } from './island.compact';
import { IslandWide } from './island.wide';
import type { IslandProps } from './island-types';

export type { IslandProps, IslandSpan } from './island-types';

export function Island(props: IslandProps): ReactNode {
  const mode = useLayoutMode();
  if (mode === 'wide') {
    return <IslandWide {...props} />;
  }
  return <IslandCompact {...props} />;
}
