/**
 * Shared `Bun.WebView` surface. Lives apart from the driver so the driver and
 * its locator node can both depend on it without importing each other.
 */

export type BunWebView = {
  navigate(url: string): Promise<void>;
  /** Native click on the element once actionable (visible, stable, topmost). */
  click(
    selector: string,
    options?: { readonly timeout?: number }
  ): Promise<void>;
  /** Native click at viewport coordinates. */
  click(x: number, y: number): Promise<void>;
  /** Native text insertion into the focused element (trusted `input`). */
  type(text: string): Promise<void>;
  /** Native key press (`Enter`, `Backspace`, `Escape`, …). */
  press(key: string): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  screenshot(): Promise<Blob | Uint8Array | Buffer>;
  close(): void;
};

export type BunWebviewHost = {
  readonly view: BunWebView;
};
