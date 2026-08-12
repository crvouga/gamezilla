import type { AssertionOptions } from '../assertions/driver-expect';
import type { DriverKey } from '../core/keys';
import type { WaitPollOptions } from '../core/wait';

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export type WaitState = 'visible' | 'hidden';

export type UiWaitOptions = { readonly timeoutMs?: number };

/** Relative position within an element's bounding box (0..1 each axis). */
export type TapPosition = {
  xRatio: number;
  yRatio: number;
};

/**
 * User-intent driver. Models what a person does with an app, not Playwright /
 * Detox / DOM primitives. Every concrete driver must satisfy this interface.
 *
 * All targets are `testId` strings. Assertions live on nested `expect`.
 * `tap` / `input` auto-wait until the target is visible before acting.
 */
export interface Driver {
  /** Stable identifier for logs and capability errors (`"in-process"`, …). */
  readonly kind: string;

  /** Boot / attach to the application under test. */
  launch(): Promise<void>;

  /** Tear down the session and release resources. */
  close(): Promise<void>;

  /** Wait until visible, then tap / click. */
  tap(testId: string, options?: UiWaitOptions): Promise<void>;

  /**
   * Tap at a relative position within the element.
   * Useful for canvases / boards where the hit target is a region, not a node.
   */
  tapAt(testId: string, position: TapPosition): Promise<void>;

  /** Wait until visible, then type `text` (appends by default). */
  input(testId: string, text: string, options?: UiWaitOptions): Promise<void>;

  /** Clear the current value of the element. */
  clear(testId: string): Promise<void>;

  /** Press a portable key (enter, escape, …). */
  key(key: DriverKey): Promise<void>;

  /**
   * Scroll within (or toward) the element.
   * `amount` is driver-defined; typically pixels or a relative fraction.
   */
  scroll(
    testId: string,
    direction: ScrollDirection,
    amount?: number
  ): Promise<void>;

  /** Poll until `testId` reaches `state`, or throw {@link TimeoutError}. */
  wait(
    testId: string,
    state: WaitState,
    options?: WaitPollOptions
  ): Promise<void>;

  readonly expect: {
    visible(testId: string, options?: AssertionOptions): Promise<void>;
    hidden(testId: string, options?: AssertionOptions): Promise<void>;
    text(
      testId: string,
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ): Promise<void>;
  };

  /** Snapshot whether `testId` is currently visible (no polling). */
  isVisible(testId: string): Promise<boolean>;

  /**
   * Read the accessible / displayed text of `testId`.
   * Drivers that cannot read text throw {@link NotImplementedError}.
   */
  getText(testId: string): Promise<string | null>;

  /**
   * Capture a readable HTML preview of the current UI for reporting.
   * Returns `null` when the driver cannot snapshot (e.g. Detox stub).
   */
  snapshotHtml(options?: {
    readonly stylesheetHref?: string;
  }): Promise<string | null>;
}
