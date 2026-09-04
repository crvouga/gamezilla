/**
 * Web focus trap via `react-focus-lock`. Traps Tab within the subtree, moves
 * focus in on activate, restores it on deactivate, and dismisses via Escape
 * when {@link FocusTrapProps.onEscape} is set. Runtime exposes dialog semantics
 * (`role="dialog"`, `aria-modal`).
 */

import { forwardRef, type ReactNode, useEffect } from 'react';
import FocusLock from 'react-focus-lock';
import type { View } from 'react-native';
import { Box, type BoxProps } from '../box';
import { pushEscapeDismissHandler } from './escape-dismiss-stack';
import type { FocusTrapProps } from './focus-trap-types';

export type { FocusTrapProps } from './focus-trap-types';

/**
 * Fill the modal host. Without this, {@link ModalBackdrop}'s `flex: 1`
 * collapses to content height on RN Web (short backdrop, dialog stuck at top).
 * Do not use inside bottom sheets — absolute fill hides in-flow content.
 */
const COVER_HOST_SX = {
  absoluteFill: true,
  flex: 1,
} as const;

/** In-flow host for bottom sheets so content height and children stay visible. */
const SHEET_HOST_SX = {
  width: '100%' as const,
  flexGrow: 1,
} as const;

const FocusTrapHost = forwardRef<View, BoxProps>(
  function FocusTrapHost(props, ref) {
    return <Box ref={ref} {...props} />;
  }
);

export function FocusTrap({
  active,
  autoFocus = true,
  returnFocus = true,
  onEscape,
  accessibilityLabel,
  layout = 'cover',
  sx,
  children,
}: FocusTrapProps): ReactNode {
  useEffect(() => {
    if (!active || onEscape === undefined) return;
    return pushEscapeDismissHandler(onEscape);
  }, [active, onEscape]);

  const layoutSx = layout === 'sheet' ? SHEET_HOST_SX : COVER_HOST_SX;

  return (
    <FocusLock
      disabled={!active}
      autoFocus={autoFocus}
      returnFocus={returnFocus}
      as={FocusTrapHost}
      lockProps={{
        sx: [layoutSx, sx],
        accessibilityRole: 'dialog',
        accessibilityViewIsModal: true,
        ...(accessibilityLabel !== undefined ? { accessibilityLabel } : {}),
        role: 'dialog',
        'aria-modal': true,
      }}
    >
      {children}
    </FocusLock>
  );
}
