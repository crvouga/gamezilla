/**
 * Keep modal chrome mounted through a short fade-out after `visible` goes false.
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

  // Open synchronously so the surface registers before paint.
  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      const anim = Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: false,
      });
      anim.start();
      return () => {
        anim.stop();
      };
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
