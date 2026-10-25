import type { DriverKey } from './keys';

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/** Enabled means visible and neither disabled nor marked aria-disabled. */
export type WaitState = 'visible' | 'hidden' | 'enabled';

/**
 * Wait until the node shows (or contains) this text.
 * Passed as the argument to {@link DriverNode.wait}.
 */
export type WaitTextCondition = {
  readonly text: string;
  readonly exact?: boolean;
};

/**
 * Wall fail-fast + error copy only.
 * No interval / pump / onPoll — each driver uses its host's fastest wait.
 */
export type DriverWaitOptions = {
  readonly timeoutMs?: number;
  readonly description?: string;
  /** For a visible wait, accept another control in the same locator scope. */
  readonly visibleOr?: readonly string[];
};

/** Alias for assert options — same slim surface as {@link DriverWaitOptions}. */
export type AssertionOptions = Pick<
  DriverWaitOptions,
  'timeoutMs' | 'description'
>;

export type UiWaitOptions = { readonly timeoutMs?: number };

/** Relative position within an element's bounding box (0..1 each axis). */
export type TapPosition = {
  xRatio: number;
  yRatio: number;
};

/** Which pointer button a coordinate gesture presses. */
export type PointerButton = 'primary' | 'secondary';

/** Options for coordinate gestures ({@link DriverNode.tapAt} / `drag`). */
export type GestureOptions = {
  /** Default `'primary'`. `'secondary'` is a right-click / right-drag. */
  readonly button?: PointerButton;
};

/** Element bounding box in host coordinates (pixels). */
export type ElementLayout = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function isWaitTextCondition(
  state: WaitState | WaitTextCondition
): state is WaitTextCondition {
  return typeof state === 'object' && state !== null && 'text' in state;
}

/**
 * User-intent driver. Models what a person does with an app, not host /
 * DOM primitives. Every concrete driver must satisfy this interface.
 *
 * Targets are resolved via {@link Driver.get} → {@link DriverNode}.
 * `tap` / `input` on a node auto-wait until visible before acting.
 *
 * {@link DriverNode.wait} is the sole waiting API — each implementation uses
 * the host framework's fastest mechanism (Bun.WebView evaluate, Solid DOM /
 * test-driver virtual pump, …). Do not reintroduce shared poll intervals here.
 */
export interface Driver {
  /** Stable identifier for logs and capability errors (`"test-driver"`, …). */
  readonly kind: string;

  /** Boot / attach to the application under test. */
  launch(): Promise<void>;

  /** Tear down the session and release resources. */
  close(): Promise<void>;

  /**
   * Resolve a testId to a locator node. Sync and never null — missing elements
   * fail on action / assert, not on get.
   */
  get(testId: string): DriverNode;

  /** Press a portable key (enter, escape, …) at page / app scope. */
  key(key: DriverKey): Promise<void>;

  /**
   * Capture a readable HTML preview of the current UI for reporting.
   * Returns `null` when the driver cannot snapshot.
   */
  snapshotHtml(options?: {
    readonly stylesheetHref?: string;
  }): Promise<string | null>;
}

/** Locator node scoped to a testId path (root or nested via {@link get}). */
export type DriverNode = {
  /** Narrow to a descendant testId within this node. */
  get(testId: string): DriverNode;

  /** Read an attribute on the actual selected UI element. Missing attributes return null. */
  attribute(name: string): Promise<string | null>;

  /** Wait until visible, then tap / click. */
  tap(options?: UiWaitOptions): Promise<void>;

  /**
   * Tap at a relative position within the element.
   * Useful for canvases / boards where the hit target is a region, not a node.
   */
  tapAt(position: TapPosition, options?: GestureOptions): Promise<void>;

  /**
   * Drag from one relative position to another within the element.
   * Useful for canvases / boards that use pan gestures.
   */
  drag(
    from: TapPosition,
    to: TapPosition,
    options?: GestureOptions
  ): Promise<void>;

  /**
   * Read the element's bounding box, or `null` when the host cannot measure.
   * May synthesize layout (test driver) so measured canvases become interactive.
   */
  layout(): Promise<ElementLayout | null>;

  /** Wait until visible, then append text, or select an absolute value for a range control. */
  input(text: string, options?: UiWaitOptions): Promise<void>;

  /** Choose a file using in-memory contents, without accessing the host filesystem. */
  selectFile(file: {
    readonly name: string;
    readonly bytes: readonly number[];
  }): Promise<void>;

  /** Clear the current value of the element. */
  clear(): Promise<void>;

  /** Press a portable key (enter, escape, …) while focused on this node. */
  key(key: DriverKey): Promise<void>;

  /**
   * Scroll within (or toward) the element.
   * `amount` is driver-defined; typically pixels or a relative fraction.
   */
  scroll(direction: ScrollDirection, amount?: number): Promise<void>;

  /**
   * Wait until this node satisfies `state` (visible / hidden / text).
   * Runtime-native — not a shared poller. Throws {@link TimeoutError} on failure.
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

  /** Snapshot whether this node is currently visible (no waiting). */
  isVisible(): Promise<boolean>;

  /**
   * Read the accessible / displayed text of this node.
   * Drivers that cannot read text throw {@link NotImplementedError}.
   */
  text(): Promise<string | null>;
};
