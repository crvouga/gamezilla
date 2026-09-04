import type { DriverKey } from '../core/keys';

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export type WaitState = 'visible' | 'hidden';

/**
 * Wait until `testId` shows (or contains) this text.
 * Passed as the second argument to {@link Driver.wait}.
 */
export type WaitTextCondition = {
  readonly text: string;
  readonly exact?: boolean;
};

/**
 * Wall fail-fast + error copy only.
 * No interval / pump / onPoll — each driver uses its host’s fastest wait.
 */
export type DriverWaitOptions = {
  readonly timeoutMs?: number;
  readonly description?: string;
};

/** Alias for assert options — same slim surface as {@link DriverWaitOptions}. */
export type AssertionOptions = DriverWaitOptions;

export type UiWaitOptions = { readonly timeoutMs?: number };

/** Relative position within an element's bounding box (0..1 each axis). */
export type TapPosition = {
  xRatio: number;
  yRatio: number;
};

export function isWaitTextCondition(
  state: WaitState | WaitTextCondition
): state is WaitTextCondition {
  return typeof state === 'object' && state !== null && 'text' in state;
}

/**
 * User-intent driver. Models what a person does with an app, not Playwright /
 * Detox / DOM primitives. Every concrete driver must satisfy this interface.
 *
 * All targets are `testId` strings. Assertions live on nested `expect`.
 * `tap` / `input` auto-wait until the target is visible before acting.
 *
 * {@link Driver.wait} is the sole waiting API — each implementation uses the
 * host framework’s fastest mechanism (Playwright auto-wait, rntl virtual
 * pump, Detox `waitFor`, …). Do not reintroduce shared poll intervals here.
 */
export interface Driver {
  /** Stable identifier for logs and capability errors (`"rntl"`, …). */
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

  /**
   * Wait until `testId` satisfies `state` (visible / hidden / text).
   * Host-native — not a shared poller. Throws {@link TimeoutError} on failure.
   */
  wait(
    testId: string,
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
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

  /** Snapshot whether `testId` is currently visible (no waiting). */
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

/**
 * User-intent driver. Models what a person does with an app, not Playwright /
 * Detox / DOM primitives. Every concrete driver must satisfy this interface.
 *
 * All targets are `testId` strings. Assertions live on nested `expect`.
 * `tap` / `input` auto-wait until the target is visible before acting.
 *
 * {@link Driver.wait} is the sole waiting API — each implementation uses the
 * host framework’s fastest mechanism (Playwright auto-wait, rntl virtual
 * pump, Detox `waitFor`, …). Do not reintroduce shared poll intervals here.
 */
export interface IdealDriver {
  /** Stable identifier for logs and capability errors (`"rntl"`, …). */
  readonly kind: string;

  /** Boot / attach to the application under test. */
  launch(): Promise<void>;

  /** Tear down the session and release resources. */
  close(): Promise<void>;

  get(testId: string): Promise<DriverNode | null>;

  /** Press a portable key (enter, escape, …). */
  key(key: DriverKey): Promise<void>;

  /**
   * Capture a readable HTML preview of the current UI for reporting.
   * Returns `null` when the driver cannot snapshot (e.g. Detox stub).
   */
  snapshotHtml(options?: {
    readonly stylesheetHref?: string;
  }): Promise<string | null>;
}

export type DriverNode = {
  get(testId: string): Promise<DriverNode | null>;

  /** Wait until visible, then tap / click. */
  tap(options?: UiWaitOptions): Promise<void>;

  /**
   * Tap at a relative position within the element.
   * Useful for canvases / boards where the hit target is a region, not a node.
   */
  tapAt(position: TapPosition): Promise<void>;

  /** Wait until visible, then type `text` (appends by default). */
  input(text: string, options?: UiWaitOptions): Promise<void>;

  /** Clear the current value of the element. */
  clear(): Promise<void>;

  /** Press a portable key (enter, escape, …). */
  key(key: DriverKey): Promise<void>;

  /**
   * Scroll within (or toward) the element.
   * `amount` is driver-defined; typically pixels or a relative fraction.
   */
  scroll(direction: ScrollDirection, amount?: number): Promise<void>;

  /**
   * Wait until `testId` satisfies `state` (visible / hidden / text).
   * Host-native — not a shared poller. Throws {@link TimeoutError} on failure.
   */
  wait(
    state: WaitState | WaitTextCondition,
    options?: DriverWaitOptions
  ): Promise<void>;

  readonly expect: {
    visible(options?: AssertionOptions): Promise<void>;
    hidden(options?: AssertionOptions): Promise<void>;
    text(
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ): Promise<void>;
  };

  /** Snapshot whether `testId` is currently visible (no waiting). */
  isVisible(): Promise<boolean>;

  text(): Promise<string | null>;
};
