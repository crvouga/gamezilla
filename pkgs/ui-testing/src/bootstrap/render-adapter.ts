import type { ReactElement } from 'react';
import type { Selector } from '../selector/selector';

/**
 * Host-agnostic node handle returned by a {@link RenderAdapter}.
 * DOM adapters use `Element`; RNTL uses `ReactTestInstance`.
 */
export type HostNode = unknown;

/**
 * Handle returned by a {@link RenderAdapter} after mounting a tree.
 * Drivers interact through this port — never through Testing Library /
 * React Native APIs directly — so alternate renderers can plug in.
 */
export interface RenderedApp {
  /**
   * Make this tree the active interaction target when multiple in-process
   * roots are mounted (RNTL only delivers pointer events to the latest root).
   */
  activate?(): void | Promise<void>;

  /** Resolve `selector` to a host element, or `null` if none match. */
  query(selector: Selector): HostNode | null;

  /** True when the element is considered visible to a user. */
  isVisible(element: HostNode): boolean;

  /** Read displayed / accessible text from the element. */
  getText(element: HostNode): string | null;

  /** Tap / click the element. */
  tap(element: HostNode): Promise<void>;

  /** Tap at a relative position within the element. */
  tapAt(
    element: HostNode,
    position: { xRatio: number; yRatio: number }
  ): Promise<void>;

  /** Type into the element (focuses first when needed). */
  typeText(element: HostNode, text: string): Promise<void>;

  /** Clear the element's current value. */
  clearText(element: HostNode): Promise<void>;

  /** Press a DOM-style key name (e.g. `"Enter"`). */
  pressKey(domKey: string): Promise<void>;

  /** Scroll the element in a direction by `amount` pixels. */
  scroll(
    element: HostNode,
    direction: 'up' | 'down' | 'left' | 'right',
    amount: number
  ): Promise<void>;

  /** Unmount and dispose the rendered tree. */
  unmount(): void | Promise<void>;

  /**
   * Optional HTML preview of the current host tree for simulation reports.
   * In-process RNTL serializes RN hosts to readable HTML; DOM adapters may
   * return `document.documentElement.outerHTML`.
   */
  snapshotHtml?(options?: { readonly stylesheetHref?: string }): string;
}

/**
 * Pluggable renderer. The shipped implementation is
 * {@link createRntlRenderAdapter} (React Native Testing Library).
 */
export interface RenderAdapter {
  render(element: ReactElement): Promise<RenderedApp>;
}
