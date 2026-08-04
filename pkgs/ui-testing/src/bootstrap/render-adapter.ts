import type { ReactElement } from 'react';
import type { Selector } from '../selector/selector';

/**
 * Handle returned by a {@link RenderAdapter} after mounting a tree.
 * Drivers interact through this port — never through Testing Library /
 * React Native APIs directly — so alternate renderers (RNTL, …) can plug in.
 */
export interface RenderedApp {
  /** Resolve `selector` to a host element, or `null` if none match. */
  query(selector: Selector): Element | null;

  /** True when the element is considered visible to a user. */
  isVisible(element: Element): boolean;

  /** Read displayed / accessible text from the element. */
  getText(element: Element): string | null;

  /** Tap / click the element. */
  tap(element: Element): Promise<void>;

  /** Type into the element (focuses first when needed). */
  typeText(element: Element, text: string): Promise<void>;

  /** Clear the element's current value. */
  clearText(element: Element): Promise<void>;

  /** Press a DOM-style key name (e.g. `"Enter"`). */
  pressKey(domKey: string): Promise<void>;

  /** Scroll the element in a direction by `amount` pixels. */
  scroll(
    element: Element,
    direction: 'up' | 'down' | 'left' | 'right',
    amount: number
  ): Promise<void>;

  /** Unmount and dispose the rendered tree. */
  unmount(): void;
}

/**
 * Pluggable renderer. The shipped implementation is `createDomRenderAdapter`
 * (react-native-web + Testing Library DOM). An RNTL adapter can satisfy the
 * same contract for Jest-based consumers.
 */
export interface RenderAdapter {
  render(element: ReactElement): Promise<RenderedApp>;
}
