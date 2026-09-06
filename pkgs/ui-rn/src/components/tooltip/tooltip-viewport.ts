import { Platform, useWindowDimensions } from 'react-native';

import type { ViewportSize } from './tooltip-layout';

export function useViewportSize(): ViewportSize {
  const { width, height } = useWindowDimensions();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width, height };
}
