/**
 * Keep modal chrome mounted through a short fade-out after `visible` goes false.
 *
 * Open is synchronous (opacity jumps to 1). Enter fades stall under Jest/RNTL
 * when `requestAnimationFrame` / timer faking races with real async I/O — the
 * surface stays at opacity 0, so role queries never see modal actions. Exit
 * fade still softens dismiss.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

const FADE_MS = 200;

export type ModalPresence = {
  /** True while the surface should stay registered (including exit fade). */
  mounted: boolean;
  opacity: Animated.Value;
};

export function useModalPresence(visible: boolean): ModalPresence {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  // Open synchronously so the surface registers before paint at full opacity.
  if (visible && !mounted) {
    setMounted(true);
    opacity.setValue(1);
  }

  useEffect(() => {
    if (visible) {
      // Re-open during an in-flight exit: cancel fade-out and show immediately.
      opacity.setValue(1);
      return;
    }
    const anim = Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => {
      anim.stop();
    };
  }, [visible, opacity]);

  return { mounted: visible || mounted, opacity };
}
