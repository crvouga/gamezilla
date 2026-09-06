import type { ElementLayout, TapPosition } from '../driver/driver';

/**
 * Runtime-agnostic node handle. DOM adapters use `Element`.
 */
export type HostNode = unknown;

/**
 * Handle returned after mounting a tree. Drivers interact through this port
 * rather than renderer-specific APIs, so alternate renderers can plug in.
 */
export interface RenderedApp {
  /**
   * Make this tree the active interaction target in a multi-actor session.
   */
  activate?(): void | Promise<void>;

  /** Resolve `testId` to a host element, or `null` if none match. */
  query(testId: string): HostNode | null;

  /** Resolve `testId` within `parent`, or `null` if none match. */
  queryWithin(parent: HostNode, testId: string): HostNode | null;

  /** True when the element is considered visible to a user. */
  isVisible(element: HostNode): boolean;

  /** Read displayed / accessible text from the element. */
  getText(element: HostNode): string | null;

  /** Tap / click the element. */
  tap(element: HostNode): Promise<void>;

  /** Tap at a relative position within the element. */
  tapAt(element: HostNode, position: TapPosition): Promise<void>;

  /** Drag from one relative position to another within the element. */
  drag(element: HostNode, from: TapPosition, to: TapPosition): Promise<void>;

  /**
   * Read (or synthesize) the element's layout box.
   * Returns `null` when the host cannot measure.
   */
  layout(element: HostNode): Promise<ElementLayout | null>;

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
   * DOM adapters may return `document.documentElement.outerHTML`.
   */
  snapshotHtml?(options?: {
    readonly stylesheetHref?: string;
  }): string | undefined;
}
