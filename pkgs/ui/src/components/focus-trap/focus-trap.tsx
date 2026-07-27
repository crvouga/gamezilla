/**
 * Native/default: no keyboard focus trap (AT uses `accessibilityViewIsModal`
 * on {@link ModalRoot}). Web implementation lives in `focus-trap.web.tsx`.
 */

import type { ReactNode } from 'react';
import type { FocusTrapProps } from './focus-trap-types';

export type { FocusTrapProps } from './focus-trap-types';

export function FocusTrap({ children }: FocusTrapProps): ReactNode {
  return <>{children}</>;
}
