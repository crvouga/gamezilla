/**
 * Web focus trap via `react-focus-lock`. Traps Tab within the subtree, moves
 * focus in on activate, restores it on deactivate, and dismisses via Escape
 * when {@link FocusTrapProps.onEscape} is set. Host exposes dialog semantics
 * (`role="dialog"`, `aria-modal`).
 */

import FocusLock from 'react-focus-lock';
import { forwardRef, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { pushEscapeDismissHandler } from './escape-dismiss-stack';
import type { FocusTrapProps } from './focus-trap-types';

export type { FocusTrapProps } from './focus-trap-types';

/**
 * Fill the modal / sheet host. Without this, {@link ModalBackdrop}'s `flex: 1`
 * collapses to content height on RN Web (short backdrop, dialog stuck at top).
 */
const FOCUS_TRAP_HOST_STYLE = {
  ...StyleSheet.absoluteFill,
  flex: 1,
} as const;

const FocusTrapHost = forwardRef<View, ViewProps>(
  function FocusTrapHost(props, ref) {
    return <View ref={ref} {...props} />;
  }
);

export function FocusTrap({
  active,
  autoFocus = true,
  returnFocus = true,
  onEscape,
  accessibilityLabel,
  children,
}: FocusTrapProps): ReactNode {
  useEffect(() => {
    if (!active || onEscape === undefined) return;
    return pushEscapeDismissHandler(onEscape);
  }, [active, onEscape]);

  return (
    <FocusLock
      disabled={!active}
      autoFocus={autoFocus}
      returnFocus={returnFocus}
      as={FocusTrapHost}
      lockProps={{
        style: FOCUS_TRAP_HOST_STYLE,
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
