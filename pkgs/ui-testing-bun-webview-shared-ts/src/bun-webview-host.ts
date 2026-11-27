/**
 * Shared `Bun.WebView` surface. Lives apart from the driver so the driver and
 * its locator node can both depend on it without importing each other.
 */

import type { Timers } from '@pkgs/clock-shared-ts/types';

export type BunWebView = {
  navigate(url: string): Promise<void>;
  /** Wait until `selector` is actionable, then native-click its center. */
  click(selector: string): Promise<void>;
  /** Native (trusted) pointer + mouse + click sequence at viewport `x`/`y`. */
  click(
    x: number,
    y: number,
    options?: { readonly button?: 'left' | 'right' | 'middle' }
  ): Promise<void>;
  /** Native key press (`Enter`, `Backspace`, `Escape`, …). */
  press(key: string): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  screenshot(): Promise<Blob | Uint8Array | Buffer>;
  close(): void;
};

export type BunWebviewHost = {
  readonly timers: Timers;
  readonly readVisibility?: (expression: string) => Promise<boolean>;
  /**
   * The window a selector's element is in: an open popup when it shows the
   * element, else the page itself. Resolving also reconciles popups.
   */
  resolveView(selector: string): Promise<BunWebView>;
};
