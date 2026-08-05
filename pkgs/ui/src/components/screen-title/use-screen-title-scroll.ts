/**
 * Scroll handlers that drive TopBar title visibility for `largeTitle` screens.
 */

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useRequiredScreenTitleContext } from './screen-title-context';

const SCROLL_EVENT_THROTTLE = 16;

export type ScreenTitleScrollProps = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
};

export function useScreenTitleScroll(): ScreenTitleScrollProps {
  const { setScrollY } = useRequiredScreenTitleContext();

  return {
    scrollEventThrottle: SCROLL_EVENT_THROTTLE,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollY(event.nativeEvent.contentOffset.y);
    },
  };
}
