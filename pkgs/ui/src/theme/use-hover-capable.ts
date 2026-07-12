import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * True when the primary input can hover with a fine pointer (mouse /
 * trackpad). Touch-first devices — including iOS Safari — report false, so
 * callers can skip sticky `:hover` / `onHoverIn` feedback there.
 *
 * Query matches the CSS idiom used by most design systems:
 * `@media (hover: hover) and (pointer: fine)`.
 */
const HOVER_CAPABLE_QUERY = '(hover: hover) and (pointer: fine)';

export function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia(HOVER_CAPABLE_QUERY);
    setCapable(mq.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setCapable(event.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return capable;
}
