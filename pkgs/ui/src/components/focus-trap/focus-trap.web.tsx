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
 * Fill the modal host. Without this, {@link ModalBackdrop}'s `flex: 1`
 * collapses to content height on RN Web (short backdrop, dialog stuck at top).
 * Do not use inside bottom sheets — absolute fill hides in-flow content.
 */
const COVER_HOST_STYLE = {
  ...StyleSheet.absoluteFill,
  flex: 1,
} as const;

/** In-flow host for bottom sheets so content height and children stay visible. */
const SHEET_HOST_STYLE = {
  width: '100%' as const,
  flexGrow: 1,
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
  layout = 'cover',
  style,
  children,
}: FocusTrapProps): ReactNode {
  useEffect(() => {
    if (!active || onEscape === undefined) return;
    return pushEscapeDismissHandler(onEscape);
  }, [active, onEscape]);

  const layoutStyle = layout === 'sheet' ? SHEET_HOST_STYLE : COVER_HOST_STYLE;

  return (
    <FocusLock
      disabled={!active}
      autoFocus={autoFocus}
      returnFocus={returnFocus}
      as={FocusTrapHost}
      lockProps={{
        style: style !== undefined ? [layoutStyle, style] : layoutStyle,
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
