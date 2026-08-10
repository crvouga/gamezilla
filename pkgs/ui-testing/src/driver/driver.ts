import type { DriverKey } from '../core/keys';
import type { WaitPollOptions } from '../core/wait';
import type { Selector } from '../selector/selector';

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export type WaitState = 'visible' | 'hidden';

/** Relative position within an element's bounding box (0..1 each axis). */
export type TapPosition = {
  xRatio: number;
  yRatio: number;
};

/**
 * User-intent driver. Models what a person does with an app, not Playwright /
 * Detox / DOM primitives. Every concrete driver must satisfy this interface.
 */
export interface Driver {
  /** Stable identifier for logs and capability errors (`"in-process"`, …). */
  readonly kind: string;

  /** Boot / attach to the application under test. */
  launch(): Promise<void>;

  /** Tear down the session and release resources. */
  close(): Promise<void>;

  /** Tap / click the element matching `target`. */
  tap(target: Selector): Promise<void>;

  /**
   * Tap at a relative position within the element matching `target`.
   * Useful for canvases / boards where the hit target is a region, not a node.
   */
  tapAt(target: Selector, position: TapPosition): Promise<void>;

  /** Type `text` into the element matching `target` (appends by default). */
  typeText(target: Selector, text: string): Promise<void>;

  /** Clear the current value of the element matching `target`. */
  clearText(target: Selector): Promise<void>;

  /** Press a portable key (enter, escape, …). */
  pressKey(key: DriverKey): Promise<void>;

  /**
   * Scroll within (or toward) the element matching `target`.
   * `amount` is driver-defined; typically pixels or a relative fraction.
   */
  scroll(
    target: Selector,
    direction: ScrollDirection,
    amount?: number
  ): Promise<void>;

  /**
   * Navigate back. Web drivers use history; native drivers use the platform
   * back gesture / button. In-process drivers may require harness cooperation.
   */
  navigateBack(): Promise<void>;

  /** Poll until `target` reaches `state`, or throw {@link TimeoutError}. */
  waitFor(
    target: Selector,
    state: WaitState,
    options?: WaitPollOptions
  ): Promise<void>;

  /** Snapshot whether `target` is currently visible (no polling). */
  isVisible(target: Selector): Promise<boolean>;

  /**
   * Read the accessible / displayed text of `target`.
   * Drivers that cannot read text throw {@link NotImplementedError}.
   */
  getText(target: Selector): Promise<string | null>;
}
