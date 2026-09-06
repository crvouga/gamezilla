/**
 * Full screen shell: header + body. Dispatches to compact (mobile / tablet
 * TopBar shell) or wide (desktop island header + card body) via
 * {@link useLayoutMode}.
 */

import type { ReactNode } from 'react';
import { useLayoutMode } from '../../theme/use-layout-mode';
import { ScreenBaseCompact } from './screen-base.compact';
import { ScreenBaseWide } from './screen-base.wide';
import type { ScreenBaseProps } from './screen-base-types';

export function ScreenBase(props: ScreenBaseProps): ReactNode {
  const mode = useLayoutMode();
  if (mode === 'wide') {
    return <ScreenBaseWide {...props} />;
  }
  return <ScreenBaseCompact {...props} />;
}
