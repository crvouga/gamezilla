/**
 * Hardware back dismiss for the topmost modal (Android / native).
 * Web: no-op — Escape is handled by {@link FocusTrap}.
 */

import { useEffect } from 'react';
import { BackHandler } from 'react-native';

export function useModalBackDismiss(
  active: boolean,
  onRequestClose: () => void
): void {
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => {
      sub.remove();
    };
  }, [active, onRequestClose]);
}
