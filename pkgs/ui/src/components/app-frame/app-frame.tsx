/**
 * `AppFrame` -- app shell that centers content on desktop and passthroughs
 * on mobile / tablet. Wide mode paints a sunken canvas and hosts the optional
 * header island above navigator content.
 */

import type { ReactNode } from 'react';
import { useLayoutMode } from '../../theme/use-layout-mode';
import { AppFrameCompact } from './app-frame.compact';
import { AppFrameWide } from './app-frame.wide';
import type { AppFrameProps } from './app-frame-types';

export type { AppFrameProps } from './app-frame-types';

export function AppFrame(props: AppFrameProps): ReactNode {
  const mode = useLayoutMode();
  if (mode === 'wide') {
    return <AppFrameWide {...props} />;
  }
  return <AppFrameCompact {...props} />;
}
