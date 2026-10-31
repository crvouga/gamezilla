import { useRequiredScreenTitleContext } from './screen-title-context/index';

export type ScreenTitleScrollProps = {
  onScroll: (event: Event) => void;
};

/** Spread onto the screen scroller so the top bar title reveals on scroll. */
export function useScreenTitleScroll(): ScreenTitleScrollProps {
  const { setScrollY } = useRequiredScreenTitleContext();
  return {
    onScroll: (event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) setScrollY(target.scrollTop);
    },
  };
}
